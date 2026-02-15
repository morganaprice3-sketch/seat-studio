const STORAGE_KEY = "event-focus-board-v1";
const SHARED_CONFIG = {
  supabaseUrl: window.SEAT_STUDIO_CONFIG?.supabaseUrl || "https://olmrilkkwjmmgkedpsde.supabase.co",
  supabaseAnonKey:
    window.SEAT_STUDIO_CONFIG?.supabaseAnonKey || "sb_publishable_21ZC210fsZA0riE6_nTVng_v2axBRWI",
};

const defaultState = {
  eventDate: "",
  people: [],
  tasks: [],
};

let state = loadState();
let currentView = "all";
let myIdentity = {
  name: "",
};

const collab = {
  client: null,
  channel: null,
  connected: false,
  roomCode: "",
  syncing: false,
  timer: null,
};

const els = {
  roomCode: document.getElementById("roomCode"),
  myName: document.getElementById("myName"),
  eventDate: document.getElementById("eventDate"),
  connectBtn: document.getElementById("connectBtn"),
  copyLinkBtn: document.getElementById("copyLinkBtn"),
  saveSnapshotBtn: document.getElementById("saveSnapshotBtn"),
  statusText: document.getElementById("statusText"),
  taskTitle: document.getElementById("taskTitle"),
  taskSection: document.getElementById("taskSection"),
  taskPriority: document.getElementById("taskPriority"),
  taskAssignee: document.getElementById("taskAssignee"),
  taskDue: document.getElementById("taskDue"),
  addTaskBtn: document.getElementById("addTaskBtn"),
  pills: document.querySelectorAll(".pill"),
  spotlightTask: document.getElementById("spotlightTask"),
  todayList: document.getElementById("todayList"),
  milestonesList: document.getElementById("milestonesList"),
  countdownList: document.getElementById("countdownList"),
  countdownMeta: document.getElementById("countdownMeta"),
};

init();

function init() {
  const roomFromUrl = getRoomFromUrl();
  myIdentity.name = localStorage.getItem("event-focus-my-name") || "";

  els.roomCode.value = roomFromUrl;
  els.myName.value = myIdentity.name;
  els.eventDate.value = state.eventDate || "";

  els.connectBtn.addEventListener("click", connectRoom);
  els.copyLinkBtn.addEventListener("click", copyShareLink);
  els.saveSnapshotBtn.addEventListener("click", saveSnapshot);
  els.addTaskBtn.addEventListener("click", addTask);

  els.myName.addEventListener("input", () => {
    myIdentity.name = els.myName.value.trim();
    localStorage.setItem("event-focus-my-name", myIdentity.name);
    renderAll();
  });

  els.eventDate.addEventListener("change", () => {
    state.eventDate = els.eventDate.value;
    persistState();
    queueSync();
    renderCountdown();
  });

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
  const roomCode = sanitizeRoomCode(els.roomCode.value || getRoomFromUrl());
  if (!roomCode) return;
  els.roomCode.value = roomCode;

  if (!window.supabase?.createClient) {
    setStatus("Could not load realtime library.");
    return;
  }

  if (collab.channel) {
    collab.channel.unsubscribe();
    collab.channel = null;
  }

  collab.client = window.supabase.createClient(SHARED_CONFIG.supabaseUrl, SHARED_CONFIG.supabaseAnonKey);
  collab.roomCode = roomCode;

  setStatus(`Connecting to room \"${roomCode}\"...`);

  try {
    const loaded = await fetchRoomState();
    if (!loaded) await createRoomState();
    subscribeRoom();
    collab.connected = true;
    setStatus(`Live in room \"${roomCode}\"`);
  } catch (err) {
    setStatus(`Connection failed: ${err.message}`);
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
  els.eventDate.value = state.eventDate || "";
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
        els.eventDate.value = state.eventDate || "";
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
  if (error) setStatus(`Sync issue: ${error.message}`);
}

function setStatus(text) {
  els.statusText.textContent = text;
}

async function copyShareLink() {
  const roomCode = sanitizeRoomCode(els.roomCode.value || getRoomFromUrl());
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomCode);
  try {
    await navigator.clipboard.writeText(url.toString());
    pulse(els.copyLinkBtn, "Copied");
  } catch {
    setStatus(`Copy this link: ${url}`);
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
    setStatus(`Snapshot issue: ${error.message}`);
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
    section: els.taskSection.value,
    priority: els.taskPriority.value,
    assignee: els.taskAssignee.value.trim(),
    due: els.taskDue.value || "",
    done: false,
    createdAt: new Date().toISOString(),
  };

  state.tasks.unshift(task);
  updatePeopleFromTask(task);
  persistState();
  queueSync();
  renderAll();

  els.taskTitle.value = "";
  els.taskAssignee.value = "";
  els.taskDue.value = "";
}

function updatePeopleFromTask(task) {
  if (!task.assignee) return;
  if (!state.people.includes(task.assignee)) {
    state.people.push(task.assignee);
  }
}

function renderAll() {
  renderSpotlight();
  renderSection("today", els.todayList);
  renderSection("milestones", els.milestonesList);
  renderSection("countdown", els.countdownList);
  renderCountdown();
}

function getVisibleTasks() {
  const tasks = state.tasks;
  if (currentView === "all") return tasks;
  if (currentView === "mine") {
    if (!myIdentity.name) return [];
    return tasks.filter((t) => t.assignee.toLowerCase() === myIdentity.name.toLowerCase());
  }
  if (currentView === "unassigned") return tasks.filter((t) => !t.assignee);
  if (currentView === "openP1") {
    return tasks.filter((t) => t.priority === "P1" && !t.done);
  }
  return tasks;
}

function renderSpotlight() {
  const task = state.tasks
    .filter((t) => !t.done)
    .sort((a, b) => {
      const p = { P1: 1, P2: 2, P3: 3 };
      return p[a.priority] - p[b.priority];
    })[0];

  if (!task) {
    els.spotlightTask.className = "spotlight-empty";
    els.spotlightTask.textContent = "No critical task yet.";
    return;
  }

  els.spotlightTask.className = "spotlight-task";
  els.spotlightTask.innerHTML = `
    <p class="task-title">${escapeHtml(task.title)}</p>
    <p class="task-meta">${task.priority} · ${escapeHtml(task.assignee || "Unassigned")}</p>
  `;
}

function renderSection(section, targetEl) {
  targetEl.innerHTML = "";
  const tasks = getVisibleTasks().filter((t) => t.section === section);

  if (!tasks.length) {
    const empty = document.createElement("p");
    empty.className = "task-meta";
    empty.textContent = "No tasks in this section yet.";
    targetEl.append(empty);
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
    targetEl.append(item);
  }
}

function renderCountdown() {
  if (!state.eventDate) {
    els.countdownMeta.textContent = "Set an event date to unlock countdown focus.";
    return;
  }

  const now = new Date();
  const eventDate = new Date(`${state.eventDate}T12:00:00`);
  const diff = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));

  if (diff > 1) {
    els.countdownMeta.textContent = `${diff} days to event day.`;
  } else if (diff === 1) {
    els.countdownMeta.textContent = "1 day to event day.";
  } else if (diff === 0) {
    els.countdownMeta.textContent = "Event day is today.";
  } else {
    els.countdownMeta.textContent = `${Math.abs(diff)} days since event day.`;
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
    eventDate: String(raw.eventDate || ""),
    people: Array.isArray(raw.people) ? raw.people.map(String) : [],
    tasks: tasks.map((t) => ({
      id: String(t.id || crypto.randomUUID()),
      title: String(t.title || ""),
      section: ["today", "milestones", "countdown"].includes(t.section) ? t.section : "today",
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
