import {
  Badge,
  Box,
  Button,
  Callout,
  Flex,
  Grid,
  Spinner,
  Text,
  TextField,
} from "@radix-ui/themes";
import * as monaco from "monaco-editor";
import { useCallback, useEffect, useRef, useState } from "react";

const FUNC_PLACEHOLDER = `(documents, events) => {\n\treturn documents[0].documentTemplateId;\n};`;

function parseJournalUrl(value) {
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const id = segments[segments.length - 1];
    const apiOrigin = url.origin.replace("//admin-", "//admin-api-");
    return { id, apiOrigin };
  } catch {
    return null;
  }
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token") ?? "");
  const [workflowId, setWorkflowId] = useState(
    () => localStorage.getItem("workflowId") ?? "",
  );
  const [apiBase, setApiBase] = useState(
    () => localStorage.getItem("apiBase") ?? "",
  );
  const [result, setResult] = useState("—");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resultHeight, setResultHeight] = useState(180);
  const dragState = useRef(null);
  const editorContainerRef = useRef(null);
  const editorRef = useRef(null);
  const resultContainerRef = useRef(null);
  const resultEditorRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("token", token);
  }, [token]);

  useEffect(() => {
    localStorage.setItem("workflowId", workflowId);
  }, [workflowId]);

  useEffect(() => {
    localStorage.setItem("apiBase", apiBase);
  }, [apiBase]);

  useEffect(() => {
    const editor = monaco.editor.create(editorContainerRef.current, {
      value: localStorage.getItem("func") ?? FUNC_PLACEHOLDER,
      language: "javascript",
      theme: "vs-dark",
      fontSize: 13,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
    });
    editorRef.current = editor;

    editor.onDidChangeModelContent(() => {
      localStorage.setItem("func", editor.getValue());
    });

    return () => {
      editor.dispose();
    };
  }, []);

  useEffect(() => {
    const editor = monaco.editor.create(resultContainerRef.current, {
      value: "—",
      language: "plaintext",
      theme: "vs-dark",
      readOnly: true,
      fontSize: 13,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: "on",
      lineNumbers: "off",
      renderLineHighlight: "none",
      padding: { top: 8, bottom: 8 },
      folding: true,
    });
    resultEditorRef.current = editor;
    return () => editor.dispose();
  }, []);

  useEffect(() => {
    const editor = resultEditorRef.current;
    if (!editor || isError) return;
    const model = editor.getModel();
    const isPlaceholder = result === "—" || result === "Running…";
    model.setValue(result);
    monaco.editor.setModelLanguage(model, isPlaceholder ? "plaintext" : "json");
  }, [result, isError]);

  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    dragState.current = { startY: e.clientY, startHeight: resultHeight };

    const onMouseMove = (e) => {
      const delta = dragState.current.startY - e.clientY;
      const next = Math.max(60, Math.min(600, dragState.current.startHeight + delta));
      setResultHeight(next);
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [resultHeight]);

  const run = useCallback(async () => {
    setIsError(false);
    setIsLoading(true);
    setResult("Running…");
    try {
      if (!token) throw new Error("Token is required");
      if (!workflowId) throw new Error("Workflow ID is required");
      if (!apiBase)
        throw new Error("API base is required (paste a journal URL)");
      const res = await fetch(`${apiBase}/workflow-logs/${workflowId}`, {
        headers: { token },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const data = await res.json();
      const documents = data.logs
        .filter((l) => l.type === "task")
        .map((l) => l.details.document);
      const events = data.logs
        .filter((l) => l.type === "event")
        .map((l) => l.details);
      // eslint-disable-next-line no-eval
      const func = eval(
        editorRef.current.getValue() + "\n//# sourceURL=func.js",
      );
      setResult(JSON.stringify(func(documents, events), null, 2));
    } catch (err) {
      setIsError(true);
      setResult(err.message || String(err));
    } finally {
      setIsLoading(false);
    }
  }, [token, workflowId, apiBase]);

  useEffect(() => {
    const onKeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run();
    };
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  }, [run]);

  return (
    <Flex direction="column" height="100vh" p="4" gap="3">
      <Grid
        columns={{ initial: "1", sm: "2fr 2fr auto" }}
        gap="2"
        flexShrink="0"
      >
        <Flex direction="column" gap="1">
          <Text
            as="label"
            htmlFor="token-input"
            size="1"
            color="gray"
            weight="medium"
          >
            Token
          </Text>
          <TextField.Root
            id="token-input"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="paste token here"
            disabled={isLoading}
            style={{ width: "100%" }}
          />
        </Flex>

        <Flex direction="column" gap="1">
          <Text
            as="label"
            htmlFor="workflow-id-input"
            size="1"
            color="gray"
            weight="medium"
          >
            Workflow ID
          </Text>
          <TextField.Root
            id="workflow-id-input"
            type="text"
            value={workflowId}
            onChange={(e) => {
              const value = e.target.value;
              const parsed = parseJournalUrl(value);
              if (parsed) {
                setWorkflowId(parsed.id);
                setApiBase(parsed.apiOrigin);
              } else {
                setWorkflowId(value);
              }
            }}
            disabled={isLoading}
            style={{ width: "100%" }}
          />
        </Flex>

        <Flex direction="column" justify="end">
          <Button onClick={run} disabled={isLoading} style={{ width: "100%" }}>
            {isLoading && <Spinner />}
            Run
          </Button>
        </Flex>
      </Grid>

      {apiBase && (
        <Badge
          color="blue"
          variant="soft"
          size="1"
          style={{ alignSelf: "flex-start" }}
        >
          API: {apiBase}
        </Badge>
      )}

      <Flex direction="column" style={{ flex: "1 1 0", minHeight: 0, gap: 0 }}>
        <Box
          ref={editorContainerRef}
          style={{
            flex: "1 1 0",
            minHeight: "100px",
            border: "1px solid var(--gray-6)",
            borderRadius: "var(--radius-2)",
            overflow: "hidden",
          }}
        />

        <div
          onMouseDown={handleDragStart}
          style={{
            height: "12px",
            flexShrink: 0,
            cursor: "ns-resize",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{
            width: "32px",
            height: "3px",
            borderRadius: "2px",
            background: "var(--gray-5)",
          }} />
        </div>

        <Flex direction="column" gap="1" style={{ height: resultHeight, flexShrink: 0 }}>
          <Text size="1" color="gray" weight="medium">
            Result
          </Text>
          <Box
            ref={resultContainerRef}
            style={{
              flex: "1 1 0",
              border: "1px solid var(--gray-6)",
              borderRadius: "var(--radius-2)",
              overflow: "hidden",
              display: isError ? "none" : "block",
            }}
          />
          {isError && (
            <Callout.Root color="red" size="1" aria-live="polite" role="status">
              <Callout.Text>[Error] {result}</Callout.Text>
            </Callout.Root>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
}
