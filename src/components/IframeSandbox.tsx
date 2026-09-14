import React, { useEffect, useRef } from 'react';

interface IframeSandboxProps {
  htmlContent: string;
  title?: string;
  onBgColorChange?: (color: string) => void;
}

export default function IframeSandbox({ htmlContent, title, onBgColorChange }: IframeSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'BG_COLOR' && event.source === iframeRef.current?.contentWindow) {
        if (onBgColorChange) {
          onBgColorChange(event.data.color);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [htmlContent, onBgColorChange]);

  if (!htmlContent) {
    return (
      <div className="flex w-full h-full items-center justify-center bg-slate-50 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
        <p>暂无 HTML 内容，请在对应的文件中粘贴原生代码</p>
      </div>
    );
  }

  // Inject a small script at the end of body to post background color
  const injectionScript = `
    <script>
      function sendBgColor() {
        let bgColor = window.getComputedStyle(document.body).backgroundColor;
        if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
           // Try to find the first large div
           const firstDiv = document.querySelector('div');
           if (firstDiv) {
             const divBg = window.getComputedStyle(firstDiv).backgroundColor;
             if (divBg !== 'rgba(0, 0, 0, 0)' && divBg !== 'transparent') {
               bgColor = divBg;
             }
           }
        }
        window.parent.postMessage({ type: 'BG_COLOR', color: bgColor }, '*');
      }
      window.addEventListener('load', sendBgColor);
      // Fallback if load already fired
      if (document.readyState === 'complete') sendBgColor();
      // Try again after 500ms for dynamic rendering
      setTimeout(sendBgColor, 500);
      // And also periodically just in case it changes
      setInterval(sendBgColor, 2000);
    </script>
  `;

  // Insert before closing body tag if it exists, else append
  let processedHtml = htmlContent;
  if (processedHtml.includes('</body>')) {
    processedHtml = processedHtml.replace('</body>', injectionScript + '</body>');
  } else {
    processedHtml += injectionScript;
  }

  return (
    <iframe
      ref={iframeRef}
      title={title || "Simulation"}
      srcDoc={processedHtml}
      className="w-full h-full border-0 bg-transparent"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      allowFullScreen
    />
  );
}
