const STORAGE_KEY = "event-focus-board-v1";
const SHARED_CONFIG = {
  supabaseUrl: window.SEAT_STUDIO_CONFIG?.supabaseUrl || "https://olmrilkkwjmmgkedpsde.supabase.co",
  supabaseAnonKey:
    window.SEAT_STUDIO_CONFIG?.supabaseAnonKey || "sb_publishable_21ZC210fsZA0riE6_nTVng_v2axBRWI",
};

const defaultState = {
  tasks: [],
};

let state = loadState();
let currentView = "all";

const collab = {
  client: null,
  channel: null,
  connected: false,
  roomCode: "",
  syncing: false,
  timer: null,
};

const els = {
  copyLinkBtn: document.getElementById("copyLinkBtn"),
  saveSnapshotBtn: document.getElementById("saveSnapshotBtn"),
  taskTitle: document.getElementById("taskTitle"),
  taskPriority: document.getElementById("taskPriority"),
  taskAssignee: document.getElementById("taskAssignee"),
  taskDue: document.getElementById("taskDue"),
  addTaskBtn: document.getElementById("addTaskBtn"),
  clearAllTasksBtn: document.getElementById("clearAllTasksBtn"),
  pills: document.querySelectorAll(".pill"),
  taskList: document.getElementById("taskList"),
};

init();

function init() {
  els.copyLinkBtn.addEventListener("click", copyShareLink);
  els.saveSnapshotBtn.addEventListener("click", saveSnapshot);
  els.addTaskBtn.addEventListener("click", addTask);
  els.clearAllTasksBtn.addEventListener("click", clearAllTasks);

  for (const pill of els.pills) {
    pill.addEventListener("click", () => {
      currentView = pill.dataset.view;
      for (const p of els.pills) p.classList.remove("active");
      pill.classList.add("active");
      renderAll();
    });
  }

  renderAll();
  connectRoom();
}

function getRoomFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return sanitizeRoomCode(params.get("room") || "main");
}

function sanitizeRoomCode(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 60);
}

async function connectRoom() {
  const roomCode = getRoomFromUrl();
  if (!roomCode) return;

  if (!window.supabase?.createClient) {
    console.error("Could not load realtime library.");
    return;
  }

  if (collab.channel) {
    collab.channel.unsubscribe();
    collab.channel = null;
  }

  collab.client = window.supabase.createClient(SHARED_CONFIG.supabaseUrl, SHARED_CONFIG.supabaseAnonKey);
  collab.roomCode = roomCode;

  try {
    const loaded = await fetchRoomState();
    if (!loaded) await createRoomState();
    subscribeRoom();
    collab.connected = true;
  } catch (err) {
    console.error("Connection failed:", err.message);
  }
}

async function createRoomState() {
  const payload = structuredClone(state);
  const { error } = await collab.client.from("event_todo_rooms").upsert(
    { code: collab.roomCode, payload, updated_at: new Date().toISOString() },
    { onConflict: "code" },
  );
  if (error) throw error;
}

async function fetchRoomState() {
  const { data, error } = await collab.client
    .from("event_todo_rooms")
    .select("payload")
    .eq("code", collab.roomCode)
    .maybeSingle();

  if (error) throw error;
  if (!data?.payload) return false;

  state = normalizeState(data.payload);
  persistState();
  renderAll();
  return true;
}

function subscribeRoom() {
  collab.channel = collab.client
    .channel(`event-todo-${collab.roomCode}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "event_todo_rooms",
        filter: `code=eq.${collab.roomCode}`,
      },
      (payload) => {
        if (!payload?.new?.payload) return;
        collab.syncing = true;
        state = normalizeState(payload.new.payload);
        persistState();
        renderAll();
        collab.syncing = false;
      },
    )
    .subscribe();
}

function queueSync() {
  if (!collab.connected || collab.syncing) return;
  if (collab.timer) clearTimeout(collab.timer);
  collab.timer = setTimeout(syncNow, 180);
}

async function syncNow() {
  if (!collab.connected) return;
  const { error } = await collab.client.from("event_todo_rooms").upsert(
    { code: collab.roomCode, payload: structuredClone(state), updated_at: new Date().toISOString() },
    { onConflict: "code" },
  );
  if (error) console.info(`Sync issue: ${error.message}`);
}

async function copyShareLink() {
  const roomCode = getRoomFromUrl();
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomCode);
  try {
    await navigator.clipboard.writeText(url.toString());
    pulse(els.copyLinkBtn, "Copied");
  } catch {
    console.info(`Copy this link: ${url}`);
  }
}

async function saveSnapshot() {
  if (!collab.connected) {
    pulse(els.saveSnapshotBtn, "Saved Local");
    return;
  }

  const { error } = await collab.client.from("event_todo_versions").insert({
    room_code: collab.roomCode,
    label: `Snapshot ${new Date().toLocaleString()}`,
    snapshot: structuredClone(state),
  });
  if (error) {
    console.info(`Snapshot issue: ${error.message}`);
    return;
  }
  pulse(els.saveSnapshotBtn, "Snapshot Saved");
}

function addTask() {
  const title = els.taskTitle.value.trim();
  if (!title) return;

  const task = {
    id: crypto.randomUUID(),
    title,
    priority: els.taskPriority.value,
    assignee: els.taskAssignee.value.trim(),
    due: els.taskDue.value || "",
    done: false,
    createdAt: new Date().toISOString(),
  };

  state.tasks.unshift(task);
  persistState();
  queueSync();
  renderAll();

  els.taskTitle.value = "";
  els.taskAssignee.value = "";
  els.taskDue.value = "";
}

function clearAllTasks() {
  if (!state.tasks.length) return;
  if (!confirm("Clear all tasks in this room? This cannot be undone.")) return;
  state.tasks = [];
  persistState();
  queueSync();
  renderAll();
  pulse(els.clearAllTasksBtn, "Cleared");
}

function renderAll() {
  renderTaskList();
}

function getVisibleTasks() {
  const tasks = state.tasks;
  if (currentView === "all") return tasks;
  if (currentView === "unassigned") return tasks.filter((t) => !t.assignee);
  if (currentView === "openP1") return tasks.filter((t) => t.priority === "P1" && !t.done);
  return tasks;
}

function renderTaskList() {
  els.taskList.innerHTML = "";
  const tasks = getVisibleTasks();

  if (!tasks.length) {
    const empty = document.createElement("p");
    empty.className = "task-meta";
    empty.textContent = "No tasks yet.";
    els.taskList.append(empty);
    return;
  }

  for (const task of tasks) {
    const item = document.createElement("article");
    item.className = `task-item ${task.done ? "done" : ""}`;

    const due = task.due ? ` · Due ${task.due}` : "";
    item.innerHTML = `
      <div class="task-main">
        <div>
          <p class="task-title">${escapeHtml(task.title)}</p>
          <p class="task-meta">${escapeHtml(task.assignee || "Unassigned")}${due}</p>
        </div>
        <span class="tag ${task.priority.toLowerCase()}">${task.priority}</span>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const doneBtn = document.createElement("button");
    doneBtn.className = "task-btn";
    doneBtn.textContent = task.done ? "Mark Open" : "Mark Done";
    doneBtn.addEventListener("click", () => {
      task.done = !task.done;
      persistState();
      queueSync();
      renderAll();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "task-btn";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      state.tasks = state.tasks.filter((t) => t.id !== task.id);
      persistState();
      queueSync();
      renderAll();
    });

    actions.append(doneBtn, delBtn);
    item.append(actions);
    els.taskList.append(item);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    return normalizeState(JSON.parse(raw));
  } catch {
    return structuredClone(defaultState);
  }
}

function normalizeState(raw) {
  const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  return {
    tasks: tasks.map((t) => ({
      id: String(t.id || crypto.randomUUID()),
      title: String(t.title || ""),
      priority: ["P1", "P2", "P3"].includes(t.priority) ? t.priority : "P2",
      assignee: String(t.assignee || ""),
      due: String(t.due || ""),
      done: Boolean(t.done),
      createdAt: String(t.createdAt || new Date().toISOString()),
    })),
  };
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function pulse(button, text) {
  const old = button.textContent;
  button.textContent = text;
  setTimeout(() => {
    button.textContent = old;
  }, 900);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
