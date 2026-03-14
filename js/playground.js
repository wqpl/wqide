import init, {
  WqSession,
  eval_wq,
  set_stdout_callback,
  set_stdin_callback,
  set_stderr_callback,
} from "../vendors/wq/pkg/wqpl.js";

let wqInited = false;

const DEBUG_FLAGS = ["inst", "ast", "token"];

async function ensureWasm() {
  if (!wqInited) {
    await init(new URL("../vendors/wq/pkg/wqpl_bg.wasm", import.meta.url));
    wqInited = true;
  }
}

function parseDebugFlags(spec) {
  if (!spec || spec === "off") return [];
  return spec
    .split(",")
    .map((flag) => flag.trim())
    .filter(Boolean);
}

function readDebugFlags(instance) {
  return parseDebugFlags(instance.debugFlagsInput?.value || "");
}

function writeDebugFlags(instance, flags) {
  const next = DEBUG_FLAGS.filter((flag) => flags.includes(flag));
  if (instance.debugFlagsInput) {
    instance.debugFlagsInput.value = next.length ? next.join(",") : "0";
  }
  DEBUG_FLAGS.forEach((flag) => {
    const button = instance.debugButtons?.[flag];
    if (!button) return;
    button.classList.toggle("active", next.includes(flag));
    button.classList.toggle("inactive", !next.includes(flag));
  });
}

function toggleDebugFlag(instance, flag) {
  const current = readDebugFlags(instance);
  const next = current.includes(flag)
    ? current.filter((item) => item !== flag)
    : [...current, flag];
  writeDebugFlags(instance, next);
}

const instances = new WeakMap();

const PLAYGROUND_TEMPLATES = {
  asciiplot: {
    code: "iota 80|map{50+35*sin[x/7]+12*sin[x/2]}|asciiplot",
    stdin: "",
  },
  primes: {
    code: "primes:{p:iota[x+1]>1;limit:floor sqrt x;i:2;W[i<=limit;$.[p[i];j:i*i;W[j<=x;p[j]:false;j:j+i]];i:$[i=2;3;i+2]];where p};primes[10000][-3..=-1]",
    stdin: "",
  },
  stdin: {
    code: 'name:input[];echo@f"Hello, {name}"',
    stdin: "C",
  },
  cowsay: {
    code: `repeat:{[s;n]acc:();N[n;acc:acc,s];acc}
cowsay:{[msg]border:repeat["-";#msg+2]
  echo(" ",border)
  echo("< ",str msg," >")
  echo(" ",border)
  echo"        \\\\   ^__^"
  echo"         \\\\  (oo)\\\\_______"
  echo"            (__)\\\\       )\\\\/\\\\"
  echo"                 ||-----w-|"
  echo"                 ||      ||"
}
cowsay input[]
`,
    stdin: "Moooving on!",
  },
};

function refreshLines(instance) {
  const lines = instance.ta.value.split("\n").length || 1;
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= lines; i++) {
    const div = document.createElement("div");
    div.className = "ln";
    div.textContent = i;
    frag.appendChild(div);
  }
  instance.gutter.innerHTML = "";
  instance.gutter.appendChild(frag);
}

function syncScroll(instance) {
  instance.gutter.scrollTop = instance.ta.scrollTop;
}

async function doEval(instance) {
  instance.runBtn.disabled = true;
  instance.output.textContent = "";
  try {
    const code = instance.ta.value;
    const stdinArr = instance.stdinInput.value
      ? instance.stdinInput.value.replace(/\\n/g, "\n").split(/\r?\n/)
      : [];
    await ensureWasm();
    set_stdout_callback((chunk) => {
      instance.output.textContent += chunk;
      instance.output.scrollTop = instance.output.scrollHeight;
      instance.editor.classList.add("has-output");
    });
    set_stderr_callback((chunk) => {
      instance.output.textContent += chunk;
      instance.output.scrollTop = instance.output.scrollHeight;
      instance.editor.classList.add("has-output");
    });
    const queue = [...stdinArr];
    set_stdin_callback((_prompt) =>
      queue.length ? String(queue.shift()) : null,
    );
    const flags = instance.debugFlagsInput?.value || "0";
    const result = flags
      ? (() => {
          const session = new WqSession();
          session.set_debug_flags(flags);
          return session.eval_wq(code);
        })()
      : eval_wq(code);
    if (result !== undefined && result !== null && String(result).length) {
      const needsNL =
        instance.output.textContent &&
        !instance.output.textContent.endsWith("\n");
      instance.output.textContent +=
        (needsNL ? "\n" : "") + "\u258d " + String(result) + "\n";
      instance.output.scrollTop = instance.output.scrollHeight;
    }
    instance.editor.classList.add("has-output");
  } catch (err) {
    console.error(err);
    instance.output.textContent = (err?.message ?? String(err)) + "\n";
  } finally {
    instance.runBtn.disabled = false;
  }
}

export async function mountPlayground(root) {
  const ta = root.querySelector("textarea.editor-text");
  const gutter = root.querySelector(".gutter");
  const output = root.querySelector(".run-output");
  const stdinInput = root.querySelector("#stdin");
  const clearOutBtn = root.querySelector("#clearOutBtn");
  const runBtn = root.querySelector("#runBtn");
  const editor = root.querySelector(".editor");
  const debugFlagsInput = root.querySelector("#playgroundDebugFlags");
  const templateButtons = Array.from(root.querySelectorAll("[data-template]"));
  const instance = {
    ta,
    gutter,
    output,
    stdinInput,
    clearOutBtn,
    runBtn,
    editor,
    debugFlagsInput,
    debugButtons: Object.fromEntries(
      DEBUG_FLAGS.map((flag) => [
        flag,
        root.querySelector(`[data-debug-flag="${flag}"]`),
      ]),
    ),
    templateButtons,
  };
  instances.set(root, instance);

  ta.addEventListener("input", () => refreshLines(instance));
  ta.addEventListener("scroll", () => syncScroll(instance));
  runBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    await doEval(instance);
  });
  ta.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey || e.shiftKey) && e.key === "Enter") {
      e.preventDefault();
      doEval(instance);
    }
  });
  clearOutBtn?.addEventListener("click", () => {
    output.textContent = "";
    editor.classList.remove("has-output");
  });
  DEBUG_FLAGS.forEach((flag) => {
    instance.debugButtons[flag]?.addEventListener("click", () => {
      toggleDebugFlag(instance, flag);
    });
  });
  templateButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const template = PLAYGROUND_TEMPLATES[button.dataset.template];
      if (!template) return;
      ta.value = template.code;
      stdinInput.value = template.stdin;
      refreshLines(instance);
      syncScroll(instance);
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
  });

  refreshLines(instance);
  writeDebugFlags(instance, []);
}

export function applyPlaygroundRoute(root, params) {
  const instance = instances.get(root);
  if (!instance) return;
  const code = params.get("code");
  const sin = params.get("stdin");
  if (code) {
    instance.ta.value = decodeURIComponent(code);
    refreshLines(instance);
  }
  if (sin) {
    instance.stdinInput.value = decodeURIComponent(sin);
  }
}
