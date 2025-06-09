#!/usr/bin/env node

/**
 * 验证 TypeScript 修复
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 验证 TypeScript 修复...');

async function checkFiles() {
    const srcDir = path.join(__dirname, '..', 'src');
    
    // 检查关键修复
    const requestLoggerPath = path.join(srcDir, 'requestLogger.ts');
    const serverPath = path.join(srcDir, 'server.ts');
    
    try {
        const requestLoggerContent = await fs.readFile(requestLoggerPath, 'utf8');
        const serverContent = await fs.readFile(serverPath, 'utf8');
        
        // 检查修复的关键模式
        console.log('✅ 检查文件存在性...');
        
        // 检查 spread 操作符修复
        if (!requestLoggerContent.includes('entry.responseData = this.sanitizeBody(responseData)')) {
            throw new Error('❌ requestLogger.ts spread 操作符修复未找到');
        }
        console.log('✅ requestLogger.ts spread 操作符修复正确');
        
        // 检查 error 类型修复
        if (!requestLoggerContent.includes('catch (error: any)')) {
            throw new Error('❌ requestLogger.ts error 类型修复未找到');
        }
        console.log('✅ requestLogger.ts error 类型修复正确');
        
        // 检查 handlerError 类型修复
        if (!serverContent.includes('catch (handlerError: any)')) {
            throw new Error('❌ server.ts handlerError 类型修复未找到');
        }
        console.log('✅ server.ts handlerError 类型修复正确');
        
        // 检查可选链使用
        if (!serverContent.includes('handlerError?.code')) {
            throw new Error('❌ server.ts 可选链修复未找到');
        }
        console.log('✅ server.ts 可选链修复正确');
        
        console.log('');
        console.log('🎉 所有 TypeScript 修复验证通过！');
        console.log('');
        console.log('修复摘要:');
        console.log('1. ✅ 修复了 spread 操作符类型错误');
        console.log('2. ✅ 修复了 error 参数类型声明');
        console.log('3. ✅ 修复了 handlerError 参数类型声明');
        console.log('4. ✅ 添加了可选链操作符避免访问 undefined 属性');
        console.log('');
        console.log('🚀 代码现在应该可以成功编译！');
        
    } catch (error) {
        console.error('❌ 验证失败:', error.message);
        process.exit(1);
    }
}

checkFiles().catch(console.error); 