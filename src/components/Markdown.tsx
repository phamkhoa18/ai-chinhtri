"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-[15px] font-bold text-stone-800 mt-2 mb-0.5 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold text-stone-800 mt-1.5 mb-0.5 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-stone-700 mt-1.5 mb-0.5 first:mt-0">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-relaxed text-stone-700 mb-1 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-4 mb-1 space-y-0.5 text-sm text-stone-700">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-4 mb-1 space-y-0.5 text-sm text-stone-700">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-stone-800">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-stone-600">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-vn-red/30 pl-2.5 py-0.5 my-1 text-sm text-stone-500 italic bg-stone-50 rounded-r-lg">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className="block bg-stone-900 text-stone-100 rounded-lg p-3 text-xs font-mono overflow-x-auto my-1 leading-relaxed">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-stone-100 text-vn-red px-1 py-0.5 rounded text-[13px] font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="my-1">{children}</pre>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-700 underline underline-offset-2 decoration-blue-300"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-1 rounded-lg border border-stone-200">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-stone-50 border-b border-stone-200">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="text-left px-3 py-1.5 text-xs font-semibold text-stone-600">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 text-sm text-stone-700 border-t border-stone-100">{children}</td>
  ),
  hr: () => <hr className="border-stone-200 my-2" />,
};

export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-custom">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
