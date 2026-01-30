#!/bin/bash

echo "================================"
echo "PDF 聊天机器人 - 快速启动脚本"
echo "================================"
echo ""

# 检查是否存在 .env 文件
check_env_file() {
  if [ ! -f "$1" ]; then
    echo "❌ 错误: 未找到 $1 文件"
    echo "   请复制 $2 为 $1 并填写配置"
    exit 1
  fi
}

# 安装依赖
install_dependencies() {
  echo "📦 安装依赖..."
  cd backend && npm install
  cd ../frontend && npm install
  cd ..
  echo "✅ 依赖安装完成"
  echo ""
}

# 检查环境变量
echo "🔍 检查环境配置..."
check_env_file "backend/.env" "backend/.env.example"
check_env_file "frontend/.env" "frontend/.env.example"
echo "✅ 环境配置检查通过"
echo ""

# 询问是否需要安装依赖
read -p "是否需要安装依赖? (y/n): " install_deps
if [ "$install_deps" = "y" ]; then
  install_dependencies
fi

# 启动服务
echo "🚀 启动服务..."
echo ""
echo "正在启动后端服务 (端口 3001)..."

# 在后台启动后端
cd backend
npm run dev &
BACKEND_PID=$!

# 等待后端启动
sleep 3

echo "正在启动前端服务 (端口 3000)..."

# 在后台启动前端
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "================================"
echo "✅ 服务启动成功!"
echo "================================"
echo ""
echo "📝 后端 API: http://localhost:3001"
echo "🌐 前端应用: http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 等待用户中断
trap "echo ''; echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT

# 保持脚本运行
wait
