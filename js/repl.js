import init, {
  WqSession,
  set_stdout_callback,
  set_stderr_callback,
  set_stdin_callback,
  get_wq_ver,
  set_box_mode,
} from "../vendors/wq/pkg/wqpl.js";

let wasmReady = false;
let session = null;
let stdinQueue = [];
let history = [];
let histIndex = -1;
let pendingBuffer = "";
let timeMode = false;
let currentTurn = null;
let execCounter = 1;
let wqVersion = "";
let ui = null;

const DEBUG_FLAGS = ["inst", "ast", "token"];

function parseDebugFlags(spec) {
  if (!spec || spec === "off") return [];
  return spec
    .split(",")
    .map((flag) => flag.trim())
    .filter(Boolean);
}

function getDebugFlags() {
  return parseDebugFlags(ensureSession().get_debug_flags());
}

function hasDebugFlag(flag) {
  return getDebugFlags().includes(flag);
}

function setDebugFlags(flags) {
  const next = DEBUG_FLAGS.filter((flag) => flags.includes(flag));
  ensureSession().set_debug_flags(next.length ? next.join(",") : "0");
  syncDebugControls();
  console.log(
    `[repl] debug flags -> ${next.length ? next.join(",") : "off"}\n`,
  );
}

function toggleDebugFlag(flag) {
  const current = getDebugFlags();
  const next = current.includes(flag)
    ? current.filter((item) => item !== flag)
    : [...current, flag];
  setDebugFlags(next);
}

function syncDebugControls() {
  const activeFlags = getDebugFlags();
  DEBUG_FLAGS.forEach((flag) => {
    setActive(ui?.debugButtons?.[flag], activeFlags.includes(flag));
  });
}

async function ensureWasm() {
  if (!wasmReady) {
    await init(new URL("../vendors/wq/pkg/wqpl_bg.wasm", import.meta.url));
    wqVersion = get_wq_ver();
    wasmReady = true;
  }
}

function promptPrefix() {
  return "wq[" + execCounter + "] ";
}

function setActive(el, on) {
  if (!el) return;
  el.classList.toggle("active", !!on);
  el.classList.toggle("inactive", !on);
}

function keepComposerLast() {
  if (ui?.composerForm?.parentElement === ui?.term) {
    ui.term.appendChild(ui.composerForm);
  }
}

function scrollThreadToBottom(mode = "composer") {
  keepComposerLast();
  if (mode === "current-turn" && currentTurn) {
    const turn = currentTurn.closest(".repl-turn");
    if (turn) {
      turn.scrollIntoView({ block: "end" });
      return;
    }
  }
  ui.term.scrollTop = ui.term.scrollHeight;
}

function createTurn(kind, label, body) {
  const turn = document.createElement("article");
  turn.className = `repl-turn repl-turn-${kind}`;
  const line = document.createElement("div");
  line.className = "repl-line";
  const meta = document.createElement("span");
  meta.className = `repl-line-meta repl-line-meta-${kind}`;
  meta.textContent = label;
  const content = document.createElement("pre");
  content.className = `repl-line-body repl-line-body-${kind}`;
  content.textContent = body;
  line.append(meta, content);
  turn.appendChild(line);
  ui.term.appendChild(turn);
  if (kind !== "input") {
    scrollThreadToBottom();
  }
  return content;
}

function append(chunk) {
  if (!currentTurn) {
    currentTurn = createTurn("system", "system", "");
  }
  currentTurn.textContent += chunk;
  scrollThreadToBottom();
}

function ensureSession() {
  if (!session) {
    session = new WqSession();
    set_stdout_callback((chunk) => append(chunk));
    set_stderr_callback((chunk) => append(chunk));
    set_stdin_callback((p) => {
      if (stdinQueue.length > 0) return String(stdinQueue.shift());
      const msg = typeof p === "string" ? p : "stdin:";
      const ans = window.prompt(msg || "stdin:");
      if (ans === null) return null;
      return ans;
    });
  }
  return session;
}

function autoSizeComposer() {
  ui.codeEl.style.height = "0px";
  const nextHeight = Math.min(Math.max(ui.codeEl.scrollHeight, 44), 160);
  ui.codeEl.style.height = `${nextHeight}px`;
}

function setButtonStatus(btn, label) {
  if (!btn) return;
  const idle = btn.dataset.idleLabel || btn.textContent;
  btn.dataset.idleLabel = idle;
  btn.textContent = label;
  const idleWidth = Number(btn.dataset.idleWidth || 0);
  btn.style.width = "auto";
  const nextWidth = Math.ceil(btn.getBoundingClientRect().width);
  btn.style.width = `${Math.max(idleWidth, nextWidth)}px`;
}

function resetButtonStatus(btn) {
  if (!btn) return;
  btn.textContent = btn.dataset.idleLabel || btn.textContent;
  const idleWidth = Number(btn.dataset.idleWidth || 0);
  if (idleWidth > 0) {
    btn.style.width = `${idleWidth}px`;
  }
}

async function fallbackCopyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  const success = document.execCommand("copy");
  textArea.remove();
  if (!success) throw new Error("Fallback copy failed");
}

async function copyCurrentOutput() {
  const turns = Array.from(
    ui.term.querySelectorAll(".repl-turn-output .repl-line-body"),
  );
  const text = turns.map((turn) => turn.textContent).join("");
  if (!text.trim()) {
    setButtonStatus(ui.copyOutputBtn, "✕ No Output");
    setTimeout(() => {
      resetButtonStatus(ui.copyOutputBtn);
    }, 1400);
    return;
  }
  try {
    await fallbackCopyText(text);
    setButtonStatus(ui.copyOutputBtn, "✓ Copied");
  } catch (err) {
    console.error(err);
    setButtonStatus(ui.copyOutputBtn, "✕ Error");
  }
  setTimeout(() => {
    resetButtonStatus(ui.copyOutputBtn);
  }, 1400);
}

async function copyCurrentFlow() {
  const turns = Array.from(ui.term.querySelectorAll(".repl-turn"));
  const parts = turns.map((turn) => {
    const meta = turn.querySelector(".repl-line-meta")?.textContent ?? "";
    const body = turn.querySelector(".repl-line-body")?.textContent ?? "";
    return body ? `${meta} ${body}` : meta;
  });
  const composerText = ui.codeEl.value.trim();
  if (composerText) {
    parts.push(`${promptPrefix().trim()} ${composerText}`);
  }
  const text = parts.filter(Boolean).join("\n\n");
  if (!text.trim()) {
    setButtonStatus(ui.copyFlowBtn, "Nothing");
    setTimeout(() => {
      resetButtonStatus(ui.copyFlowBtn);
    }, 1400);
    return;
  }
  try {
    await fallbackCopyText(text);
    setButtonStatus(ui.copyFlowBtn, "✓ Copied");
  } catch (err) {
    console.error(err);
    setButtonStatus(ui.copyFlowBtn, "Error");
  }
  setTimeout(() => {
    resetButtonStatus(ui.copyFlowBtn);
  }, 1400);
}

function resetSession() {
  session = null;
  stdinQueue = [];
  history = [];
  histIndex = -1;
  pendingBuffer = "";
  execCounter = 1;
  currentTurn = null;
  ui.term.innerHTML = "";
  ui.term.appendChild(ui.composerForm);
  ensureSession();
  append(`wq ${wqVersion} (c)tttiw (l)MIT\n`);
  setActive(ui.pillBox, false);
  setActive(ui.pillTime, false);
  syncDebugControls();
}

async function doEval() {
  const code = ui.codeEl.value;
  if (!code.trim()) return;
  createTurn("input", promptPrefix().trim(), code.trim());
  currentTurn = createTurn("output", "runtime", "");
  execCounter++;
  ui.evalBtn.disabled = true;
  try {
    const start = performance.now();
    const out = ensureSession().eval_wq(code);
    const end = performance.now();
    if (!history.length || history[history.length - 1] !== code) {
      history.push(code);
    }
    histIndex = -1;
    pendingBuffer = "";
    if (out !== undefined && out !== null && String(out).length) {
      const formatted = String(out)
        .split("\n")
        .map((line, index) => (index === 0 ? line : "  " + line))
        .join("\n");
      append("\u258d " + formatted + "\n");
      if (timeMode === true) {
        append(`\u258d time elapsed: ${end - start}ms\n`);
      }
    }
    ui.codeEl.value = "";
    autoSizeComposer();
  } catch (err) {
    console.error("err from wq:" + err);
    append((err?.message ?? String(err)) + "\n");
  } finally {
    ui.evalBtn.disabled = false;
    currentTurn = null;
  }
}

export async function mountRepl(root) {
  await ensureWasm();
  ui = {
    codeEl: root.querySelector("#code"),
    term: root.querySelector("#term"),
    composerForm: root.querySelector("#composerForm"),
    evalBtn: root.querySelector("#evalBtn"),
    clearBtn: root.querySelector("#clearBtn"),
    resetBtn: root.querySelector("#resetBtn"),
    copyFlowBtn: root.querySelector("#copyFlowBtn"),
    copyOutputBtn: root.querySelector("#copyOutputBtn"),
    stdinLine: root.querySelector("#stdinLine"),
    pushStdinBtn: root.querySelector("#pushStdinBtn"),
    pillBox: root.querySelector("#pillBox"),
    pillTime: root.querySelector("#pillTime"),
    debugButtons: Object.fromEntries(
      DEBUG_FLAGS.map((flag) => [
        flag,
        root.querySelector(`[data-debug-flag="${flag}"]`),
      ]),
    ),
  };

  [ui.copyFlowBtn, ui.copyOutputBtn].forEach((btn) => {
    if (!btn) return;
    btn.dataset.idleLabel = btn.textContent;
    requestAnimationFrame(() => {
      const rect = btn.getBoundingClientRect();
      const idleWidth = Math.ceil(rect.width);
      const idleHeight = Math.ceil(rect.height);
      btn.dataset.idleWidth = String(idleWidth);
      btn.style.width = `${idleWidth}px`;
      btn.style.height = `${idleHeight}px`;
    });
  });

  ui.resetBtn.addEventListener("click", () => resetSession());
  ui.copyFlowBtn?.addEventListener("click", () => {
    copyCurrentFlow();
  });
  ui.copyOutputBtn?.addEventListener("click", () => {
    copyCurrentOutput();
  });
  ui.pillBox?.addEventListener("click", () => {
    const on = set_box_mode();
    setActive(ui.pillBox, on);
    console.log(`[repl] box mode -> ${on ? "on" : "off"}\n`);
  });
  ui.pillTime?.addEventListener("click", () => {
    timeMode = !timeMode;
    setActive(ui.pillTime, timeMode);
    console.log(`[repl] time mode -> ${timeMode ? "on" : "off"}\n`);
  });
  DEBUG_FLAGS.forEach((flag) => {
    ui.debugButtons[flag]?.addEventListener("click", () => {
      toggleDebugFlag(flag);
    });
  });
  ui.pushStdinBtn.addEventListener("click", () => {
    const text = ui.stdinLine.value;
    if (!text) return;
    const normalized = text.replace(/\\n/g, "\n");
    const lines = normalized.includes("\n")
      ? normalized.split(/\r?\n/)
      : [normalized];
    try {
      ensureSession();
      stdinQueue.push(...lines);
      append(`pushed ${lines.length} line(s) to stdin\n`);
      ui.stdinLine.value = "";
    } catch (e) {
      console.error(e);
      append((e?.message ?? String(e)) + "\n");
    }
  });
  ui.composerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    doEval();
  });
  ui.clearBtn.addEventListener("click", () => {
    ui.term.innerHTML = "";
    currentTurn = null;
    ui.term.appendChild(ui.composerForm);
    autoSizeComposer();
  });
  ui.codeEl.addEventListener("input", () => autoSizeComposer());
  ui.codeEl.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      doEval();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doEval();
    } else if (!e.shiftKey && !e.ctrlKey && !e.metaKey && e.key === "ArrowUp") {
      if (history.length) {
        e.preventDefault();
        if (histIndex === -1) {
          pendingBuffer = ui.codeEl.value;
          histIndex = history.length - 1;
        } else if (histIndex > 0) {
          histIndex--;
        }
        ui.codeEl.value = history[histIndex];
        ui.codeEl.selectionStart = ui.codeEl.selectionEnd =
          ui.codeEl.value.length;
      }
    } else if (
      !e.shiftKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      e.key === "ArrowDown"
    ) {
      if (history.length && histIndex !== -1) {
        e.preventDefault();
        if (histIndex < history.length - 1) {
          histIndex++;
          ui.codeEl.value = history[histIndex];
        } else {
          histIndex = -1;
          ui.codeEl.value = pendingBuffer;
        }
        ui.codeEl.selectionStart = ui.codeEl.selectionEnd =
          ui.codeEl.value.length;
      }
    }
  });

  autoSizeComposer();
  resetSession();
}
