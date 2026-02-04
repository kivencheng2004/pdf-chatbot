-- 修复 match_documents 函数参数不匹配的问题
-- 错误信息显示 LangChain 调用时传递了: filter, match_count, query_embedding
-- 但数据库中可能定义了包含 match_threshold 的函数，导致 PostgREST 找不到匹配的函数

-- 1. 删除旧的函数定义（包括可能的重载版本）
DROP FUNCTION IF EXISTS match_documents(vector, float, int, jsonb);
DROP FUNCTION IF EXISTS match_documents(vector, int, jsonb);

-- 2. 创建新的函数，参数与 LangChain 调用完全匹配
-- 注意：去掉了 match_threshold 参数
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count int DEFAULT 10,
  filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  FROM documents
  WHERE
    -- 如果需要相似度阈值过滤，可以在这里取消注释并调整数值
    -- 1 - (documents.embedding <=> query_embedding) > 0.5 AND
    (filter = '{}'::jsonb OR documents.metadata @> filter)
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 3. 刷新 Schema Cache (通常 Supabase 会自动处理，但如果不行可以手动重载)
NOTIFY pgrst, 'reload config';
