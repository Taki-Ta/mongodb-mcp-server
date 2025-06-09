#!/usr/bin/env node

/**
 * 简单的构建测试脚本
 * 验证TypeScript编译是否成功
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔧 开始构建测试...');

try {
    // 清理dist目录
    if (fs.existsSync('dist')) {
        fs.rmSync('dist', { recursive: true, force: true });
        console.log('🗑️ 清理dist目录');
    }

    // 运行TypeScript编译
    console.log('📦 运行TypeScript编译...');
    execSync('npm run build:compile', { stdio: 'inherit' });
    
    // 检查dist目录是否生成
    if (fs.existsSync('dist/index.js')) {
        console.log('✅ 构建成功! dist/index.js 已生成');
        
        // 检查关键文件
        const keyFiles = [
            'dist/index.js',
            'dist/tools/mongodb/read/find.js',
            'dist/tools/mongodb/metadata/listCollections.js',
            'dist/config.js',
            'dist/logger.js'
        ];
        
        const missingFiles = keyFiles.filter(file => !fs.existsSync(file));
        
        if (missingFiles.length > 0) {
            console.log('⚠️ 缺少文件:', missingFiles);
        } else {
            console.log('✅ 所有关键文件都已生成');
        }
        
        // 简单语法检查
        try {
            require('./dist/index.js');
            console.log('❌ 不应该能够直接require入口文件');
        } catch (error) {
            if (error.message.includes('ERR_REQUIRE_ESM')) {
                console.log('✅ ESM模块格式正确');
            } else {
                console.log('⚠️ 其他错误:', error.message);
            }
        }
        
    } else {
        console.log('❌ 构建失败: dist/index.js 未生成');
        process.exit(1);
    }
    
} catch (error) {
    console.error('❌ 构建错误:', error.message);
    process.exit(1);
}

console.log('🎉 构建测试完成!'); 