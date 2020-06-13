module.exports = {
    verbose: true,//显示详细信息
    clearMocks: true,//清除mocks
    collectCoverage: true,//收集测试覆盖率信息
    reporters: ["default", "jest-junit"],
    moduleFileExtensions: ["js", "jsx", "ts", "tsx"],
    moduleDirectories: ['node_modules'],
    transform: {//如果模块是以.tsx结尾的话,需要用ts-jest进行转译
        '^.+\\.tsx?$': "ts-jest"
    },
    //表示要进行单元测试的正则匹配
    testRegex: '(/test/.*|(test|spec)\\.(jsx|tsx))$'
}