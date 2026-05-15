# 数据来源说明

## 词表

- 来源：教育部《普通高中英语课程标准（2017 年版 2020 年修订）》附录 2 词汇表
- 本地文件：`moe-high-school-english-curriculum-2017-2020.pdf`
- 原始链接：<https://www.pep.com.cn/xw/zt/rjwy/gzkb2020/202205/P020220517522153664167.pdf>
- 用途：确定第一版“高考课标词 / 高考基础词”的收词范围和阶段标记。

## 释义与音标预填

- 来源：ECDICT 开源英汉词典
- 本地文件：`ecdict.csv`
- 许可文件：`ECDICT-LICENSE.txt`
- 原始项目：<https://github.com/skywind3000/ECDICT>
- 用途：原型阶段预填中文释义和音标，正式上线前需要二次编辑为学习型释义，并保留开源许可说明。

## 记忆图字段

当前原型没有批量生成真实图片文件，先为每个词生成 `memoryImage`：

- `meaning`：一个基础中文释义
- `pos`：词性
- `scene`：记忆场景
- `prompt`：后续接图像生成接口时使用的提示词

正式上线前应把提示词批量生成图片，图片内包含中文释义、场景和词性，并统一风格、尺寸和版权归属。

## 生成方式

```bash
npm run build:words
```

生成结果：

- `data/words.js`
- `data/test-questions.js`
- `data/word-source-report.json`
