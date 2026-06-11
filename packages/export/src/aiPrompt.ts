export type AiPromptFramework = 'react-tailwind' | 'vue' | 'html';

const FRAMEWORK_LABELS: Record<AiPromptFramework, string> = {
  'react-tailwind': 'React+Tailwind',
  vue: 'Vue',
  html: '纯 HTML',
};

export function generateAiPrompt(
  markdown: string,
  framework: AiPromptFramework = 'react-tailwind',
): string {
  const fw = FRAMEWORK_LABELS[framework];
  return `你是前端工程师。请基于以下线框结构生成 ${fw} 页面骨架代码,
只关注结构与语义,使用占位数据,不要追求视觉精确:

${markdown}

要求:组件化拆分、语义化标签、TODO 注释标记交互逻辑。`;
}
