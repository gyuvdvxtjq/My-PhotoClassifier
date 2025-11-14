#!/usr/bin/env node
import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {CallToolRequestSchema, ListToolsRequestSchema} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";

// --- 配置常量 (请通过环境变量或直接修改来设置您的 GitHub 文件信息) ---

// **必需**: GitHub 上 JSON 文件的 Raw URL。
// 格式应为：https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path/to/file.json>
const GITHUB_FILE_URL = process.env.GITHUB_FILE_URL || "https://raw.githubusercontent.com/example/repo/main/image_links.json";

// GitHub Personal Access Token (可选，如果文件在私有仓库)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";


/**
 * In-memory 存储图片链接。
 * 结构:
 * {
 * "类型名称": ["http://url1.com", "http://url2.com"],
 * "另一种类型": ["http://url3.com"],
 * }
 */
const imageStore = {};
let isStoreInitialized = false;


/**
 * 从指定的 GitHub Raw URL 获取 JSON 文件内容并解析，然后填充 imageStore。
 */
async function fetchAndParseJsonFile() {
    const url = GITHUB_FILE_URL;
    const headers = {
        'Accept': 'application/json',
        'User-Agent': 'MCP-GitHub-Json-Server'
    };
    if (GITHUB_TOKEN) {
        // 通常 Raw URL 不需要 token，但如果仓库是私有的，则需要
        headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    }

    try {
        console.error(`Fetching JSON file from: ${url}`);
        const response = await fetch(url, {headers});

        if (!response.ok) {
            // 检查常见的 404/403 错误
            throw new Error(`Failed to fetch file. Status: ${response.status}. Check GITHUB_FILE_URL.`);
        }

        const fileContent = await response.json();

        // 验证解析后的内容是否为预期的对象格式
        if (typeof fileContent !== 'object' || fileContent === null || Array.isArray(fileContent)) {
            throw new Error("Parsed content is not a valid JSON object map.");
        }

        // 遍历并加载数据
        for (const [category, links] of Object.entries(fileContent)) {
            if (Array.isArray(links) && links.every(link => typeof link === 'string')) {
                // 确保类别名称不为空，并且链接是字符串数组
                imageStore[category] = links;
            } else {
                console.error(`Warning: Skipping category '${category}'. Links must be an array of strings.`);
            }
        }

    } catch (error) {
        console.error(`Fatal Error: Could not load data from GitHub JSON file. Details: ${error.message}`);
        // 清空 store，确保 isStoreInitialized 为 false 的逻辑能起作用
        Object.keys(imageStore).forEach(key => delete imageStore[key]);
    }
}


// --- MCP 工具定义 ---

const IMAGE_LOOKUP_TOOL = {
    name: "get_image_link",
    description: "Retrieves multiple public image URLs by category and number of image.",
    inputSchema: {
        type: "object",
        properties: {
            category: {
                type: "string",
                description: "The name of the category, which corresponds to a key in the loaded JSON file.",
            },
            num: {
                type: "integer",
                description: "The number of image links to retrieve from the category. Default is 1.",
                minimum: 1,
            }
        },
        required: ["category"],
    }
};

const TOOLS = [IMAGE_LOOKUP_TOOL];

/**
 * 实际执行图片链接查找逻辑的函数。
 * @param {string} category 图片类别名称
 * @param {number} num 获取的图片数量
 */
async function getImageLink(category, num) {
    // num 默认值为 1
    const count = Math.max(1, num || 1);

    if (!isStoreInitialized) {
        return {
            content: [{
                type: "text",
                text: "Error: Image store is not yet initialized. Please check the server logs for loading errors."
            }],
            isError: true
        };
    }

    const categoryData = imageStore[category];
    if (!categoryData) {
        return {
            content: [{
                type: "text",
                text: `Error: Category '${category}' not found. Available categories: ${Object.keys(imageStore).join(', ')}`
            }],
            isError: true
        };
    }

    const res = [];
    // 实际获取的数量
    const actualCount = Math.min(count, categoryData.length);

    // 如果请求的数量大于实际可用数量，或者请求多个，则进行随机选取（带有去重逻辑）
    if (actualCount === categoryData.length || actualCount > 1) {
        const idxSet = new Set();
        while (idxSet.size < actualCount) {
            // 在 [0, categoryData.length - 1] 范围内随机选择索引
            const chooseIdx = Math.floor(Math.random() * categoryData.length);
            idxSet.add(chooseIdx);
        }

        for (const idx of idxSet) {
            res.push({
                type: "text",
                text: categoryData[idx] + "\n"
            });
        }

    } else {
        // 只请求 1 个链接时，直接随机选取 1 个
        const chooseIdx = Math.floor(Math.random() * categoryData.length);
        res.push({
            type: "text",
            text: categoryData[chooseIdx] + "\n"
        });
    }

    return {
        content: res,
        isError: false
    };
}


// --- MCP 服务器设置与运行 ---

const server = new Server({
    name: "mcp-server/github-json-lookup",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});

// 设置工具列表请求处理
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
}));

// 设置工具调用请求处理
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        switch (request.params.name) {
            case "get_image_link": {
                const {category, num} = request.params.arguments;
                // 确保 num 是一个有效的数字，默认为 1
                let numericNum = parseInt(num);
                if (isNaN(numericNum) || numericNum < 1) {
                    numericNum = 1;
                }
                return await getImageLink(category, numericNum);
            }
            default:
                return {
                    content: [{
                        type: "text",
                        text: `Unknown tool: ${request.params.name}`
                    }],
                    isError: true
                };
        }
    } catch (error) {
        return {
            content: [{
                type: "text",
                text: `Tool execution error: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
        };
    }
});

async function runServer() {
    console.error(`Starting data retrieval from GitHub JSON file: ${GITHUB_FILE_URL}`);

    // 1. 初始化数据仓库
    await fetchAndParseJsonFile();

    // 2. 标记初始化完成并打印统计信息
    const totalCategories = Object.keys(imageStore).length;
    const totalImages = Object.values(imageStore).reduce((sum, arr) => sum + arr.length, 0);

    // 只有在成功加载到数据时才标记初始化完成
    if (totalCategories > 0) {
        isStoreInitialized = true;
        console.error(`GitHub Image Store Initialized Successfully.`);
        console.error(`Total Categories Loaded: ${totalCategories}`);
        console.error(`Total Images Loaded: ${totalImages}`);
        console.error(`Example Categories: ${Object.keys(imageStore).slice(0, 5).join(', ')}`);
    } else {
        isStoreInitialized = false;
        console.error("Warning: No data was loaded. Check your GITHUB_FILE_URL and ensure the file exists and has the correct JSON format.");
    }


    // 3. 连接 MCP 传输层
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("GitHub JSON Lookup MCP Server running on stdio");
}

runServer().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});