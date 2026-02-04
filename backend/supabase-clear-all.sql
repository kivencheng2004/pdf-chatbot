-- 清理所有文档数据
-- 这将删除 documents 表中的所有行，并重置自增 ID
TRUNCATE TABLE documents;

-- 如果上面的命令因为权限问题无法执行，可以使用下面的命令：
-- DELETE FROM documents;
