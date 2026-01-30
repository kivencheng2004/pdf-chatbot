-- PDF 聊天机器人 Supabase 数据库设置脚本

-- 1. 启用 pgvector 扩展
create extension if not exists vector;

-- 2. 创建文档表
create table if not exists documents (
  id bigserial primary key,
  content text not null,
  metadata jsonb,
  embedding vector(1536),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. 创建索引以加速向量搜索
-- 使用 IVFFlat 索引算法提高大规模数据的搜索性能
create index if not exists documents_embedding_idx 
  on documents 
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 4. 创建元数据索引以支持用户过滤
create index if not exists documents_metadata_idx 
  on documents 
  using gin (metadata);

-- 5. 创建相似度搜索函数
create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 10,
  filter jsonb default '{}'::jsonb
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 
    -- 相似度过滤
    1 - (documents.embedding <=> query_embedding) > match_threshold
    -- 元数据过滤(如果提供)
    and (
      filter = '{}'::jsonb 
      or documents.metadata @> filter
    )
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 6. 创建删除用户文档的函数
create or replace function delete_user_documents(
  user_id text
)
returns void
language plpgsql
as $$
begin
  delete from documents
  where metadata->>'userId' = user_id;
end;
$$;

-- 7. 启用行级安全(可选,用于多租户场景)
-- alter table documents enable row level security;

-- 8. 创建策略(可选)
-- create policy "Users can only access their own documents"
--   on documents
--   for all
--   using (metadata->>'userId' = auth.uid()::text);

-- 9. 授予权限
-- grant usage on schema public to anon, authenticated;
-- grant all on documents to anon, authenticated;
-- grant all on sequence documents_id_seq to anon, authenticated;

-- 完成!数据库已配置完成
-- 现在可以开始使用 PDF 聊天机器人了
