'use client';

import { useState, useRef, useEffect, useCallback } from 'react'

const SANDBOX_HTML = `<!DOCTYPE html>
<html><head><script>
window.addEventListener('message', function(e) {
  if (e.source !== parent) return;
  var logs = [];
  varMethods = ['log','error','warn'];
  for (var i = 0; i < varMethods.length; i++) {
    (function(m) {
      console[m] = function() {
        var args = Array.prototype.slice.call(arguments);
        var type = m === 'log' ? 'log' : m === 'error' ? 'error' : 'warn';
        logs.push({ type: type, args: args.map(function(a) {
          return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a);
        })});
      };
    })(varMethods[i]);
  }
  try {
    new Function(e.data)();
    parent.postMessage({ type: 'done', logs: logs }, '*');
  } catch(err) {
    logs.push({ type: 'error', args: ['[Runtime Error] ' + err.message] });
    parent.postMessage({ type: 'done', logs: logs }, '*');
  }
});
</script></head><body></body></html>`;

export function OpenCodeSandboxTab() {
  const [code, setCode] = useState([
    '// Welcome to OpenCode Sandbox',
    '// Write JavaScript code here and run it',
    '',
    'function greet(name) {',
    '  return `Hello, ${name}! Welcome to Vylix Academic Hub.`;',
    '}',
    '',
    "const courses = ['CSC 201', 'MTH 201', 'PHY 201'];",
    'courses.forEach(c => console.log(greet(c)));',
    '',
    '// Try editing this code and click Run',
  ].join('\n'))
  const [output, setOutput] = useState<string[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'done' && Array.isArray(e.data.logs)) {
        setOutput(e.data.logs.map((l: { type: string; args: string[] }) =>
          l.type === 'error' ? `[Error] ${l.args.join(' ')}` :
          l.type === 'warn' ? `[Warn] ${l.args.join(' ')}` :
          l.args.join(' ')
        ))
        setIsRunning(false)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleRun = useCallback(() => {
    setIsRunning(true)
    setOutput([])
    iframeRef.current?.contentWindow?.postMessage(code, '*')
  }, [code])

  const handleClear = () => {
    setOutput([])
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <iframe
        ref={iframeRef}
        srcDoc={SANDBOX_HTML}
        sandbox="allow-scripts"
        className="hidden"
        title="code-sandbox"
      />
      <div className="p-3 border-b border-gray-100 tool-header-bg-blue">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-tight">OpenCode Sandbox</h3>
            <p className="text-xs text-gray-400">Client-side JavaScript playground</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClear}
              className="text-xs py-2 px-3 min-h-[44px] rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium transition-colors border border-gray-200/50"
            >
              Clear
            </button>
            <button
              onClick={handleRun}
              disabled={isRunning}
              className="text-xs py-2 px-4 min-h-[44px] rounded-lg bg-gradient-to-r from-blue-600 to-sky-500 text-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] font-medium transition-all duration-200 disabled:opacity-50"
            >
              {isRunning ? 'Running...' : 'Run'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 p-3">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-full resize-none font-mono text-sm bg-gray-900 text-gray-100 rounded-xl p-4 border-0 focus:ring-1 focus:ring-blue-500"
            spellCheck={false}
          />
        </div>

        <div className="border-t border-gray-100">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Console Output</h4>
              {output.length > 0 && (
                <span className="text-xs text-gray-400">{output.length} line{output.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            <div
              ref={outputRef}
              className="bg-gray-900 rounded-xl p-3 max-h-40 overflow-y-auto font-mono text-xs min-h-[60px]"
            >
              {output.length === 0 ? (
                <span className="text-gray-500 italic">Click &quot;Run&quot; to execute your code...</span>
              ) : (
                output.map((line, i) => (
                  <div
                    key={i}
                    className={`${
                      line.startsWith('[Error]') ? 'text-red-400' : line.startsWith('[Warn]') ? 'text-yellow-400' : 'text-gray-100'
                    } animate-fade-in`}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <span className="text-gray-500 mr-2">{`>`}</span>
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
