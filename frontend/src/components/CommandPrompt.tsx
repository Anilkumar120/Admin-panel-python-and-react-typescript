import { useState } from "react";
import Terminal, { ColorMode, TerminalOutput } from "react-terminal-ui";

type Props = {
  /** Called when user submits a command. Return the output string. */
  onRunCommand?: (cmd: string) => Promise<string> | string;
  title?: string;
};

export default function CommandPrompt({
  onRunCommand,
  title = "inventory > terminal",
}: Props) {
  const [lines, setLines] = useState<React.ReactNode[]>([
    <TerminalOutput key="welcome">
      Type <b>help</b> to see available commands.
    </TerminalOutput>,
  ]);

  const handleInput = async (input: string) => {
    const cmd = input.trim();
    if (!cmd) return;

    // Echo command
    setLines((prev) => [
      ...prev,
      <TerminalOutput key={`in-${Date.now()}`}>$ {cmd}</TerminalOutput>,
    ]);

    // Built-in commands
    if (cmd === "clear") {
      setLines([]);
      return;
    }

    let output = "";

    if (cmd === "help") {
      output = "Commands: help, list, add, clear";
    } else if (cmd === "list") {
      output = "📦 (connect backend to load products)";
    } else if (onRunCommand) {
      try {
        output = await onRunCommand(cmd);
      } catch (err) {
        output = `❌ Error: ${(err as Error).message}`;
      }
    } else {
      output = `❌ Unknown command: ${cmd}`;
    }

    setLines((prev) => [
      ...prev,
      <TerminalOutput key={`out-${Date.now()}`}>{output}</TerminalOutput>,
    ]);
  };

  return (
    <div className="terminal-card">
      <div className="terminal-card-header">
        <h2>{title}</h2>
      </div>
      <div className="terminal-card-body">
        <Terminal
          name=""
          prompt="›"
          height="360px"
          colorMode={ColorMode.Dark}
          onInput={handleInput}
        >
          {lines}
        </Terminal>
      </div>
    </div>
  );
}