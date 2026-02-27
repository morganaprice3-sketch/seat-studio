const STORAGE_KEY = "the-seat-studio-v1";
const HISTORY_KEY = "the-seat-studio-history-v1";

const SHARED_CONFIG = {
  // Set these once for link-based collaboration, or inject window.SEAT_STUDIO_CONFIG.
  supabaseUrl: window.SEAT_STUDIO_CONFIG?.supabaseUrl || "https://olmrilkkwjmmgkedpsde.supabase.co",
  supabaseAnonKey:
    window.SEAT_STUDIO_CONFIG?.supabaseAnonKey || "sb_publishable_21ZC210fsZA0riE6_nTVng_v2axBRWI",
};

const MIN_SEATS = 6;
const MAX_SEATS = 12;

const defaultState = {
  mainTables: [],
  overflowTables: [],
  mainDoorways: [],
  guests: [],
  nextGuestId: 1,
};

const state = loadState();
let history = loadHistory();
const collab = {
  client: null,
  channel: null,
  connected: false,
  roomCode: "",
  stateSyncTimer: null,
  applyingRemote: false,
};

const els = {
  mainTableCount: document.getElementById("mainTableCount"),
  overflowTableCount: document.getElementById("overflowTableCount"),
  generateBtn: document.getElementById("generateBtn"),
  jumpButtons: document.querySelectorAll("[data-jump-target]"),
  overflowJumpBtn: document.querySelector('[data-jump-target="overflowLayoutSection"]'),
  tableConfigList: document.getElementById("tableConfigList"),
  breadcrumbList: document.getElementById("breadcrumbList"),
  clearSavesBtn: document.getElementById("clearSavesBtn"),
  saveBtn: document.getElementById("saveBtn"),
  exportCurrentBtn: document.getElementById("exportCurrentBtn"),
  exportTableSetupBtn: document.getElementById("exportTableSetupBtn"),
  resetBtn: document.getElementById("resetBtn"),
  layoutTableEditor: document.getElementById("layoutTableEditor"),
  overflowTableEditor: document.getElementById("overflowTableEditor"),
  roomCanvas: document.getElementById("roomCanvas"),
  overflowLayoutSection: document.getElementById("overflowLayoutSection"),
  overflowRoomCanvas: document.getElementById("overflowRoomCanvas"),
  seatDialog: document.getElementById("seatDialog"),
  seatForm: document.getElementById("seatForm"),
  seatDialogTitle: document.getElementById("seatDialogTitle"),
  seatGuestSelect: document.getElementById("seatGuestSelect"),
  removeSeatBtn: document.getElementById("removeSeatBtn"),
  quickGuestName: document.getElementById("quickGuestName"),
  quickGuestGroup: document.getElementById("quickGuestGroup"),
  quickAddGuestBtn: document.getElementById("quickAddGuestBtn"),
};

let activeSeatRef = null;
let dragging = null;
let selectedMainTableId = null;
let selectedOverflowTableId = null;
let didDrag = false;
let mainEditorNameInput = null;
let overflowEditorNameInput = null;

if (!state.mainTables.length && !state.overflowTables.length) {
  regenerateRoomTables("main", 12);
  regenerateRoomTables("overflow", 6);
}
if (!Array.isArray(state.mainDoorways) || state.mainDoorways.length !== 2) {
  state.mainDoorways = getDefaultMainDoorways();
}

syncControlsFromState();
renderAll();
connectCollabFromLink();

els.generateBtn.addEventListener("click", () => {
  const mainCount = clampInt(els.mainTableCount.value, 0, 100);
  const overflowCount = clampInt(els.overflowTableCount.value, 0, 100);
  regenerateRoomTables("main", mainCount);
  regenerateRoomTables("overflow", overflowCount);
  renderAll();
  persistState();
});

for (const btn of els.jumpButtons) {
  btn.addEventListener("click", () => {
    const id = btn.dataset.jumpTarget;
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

els.saveBtn.addEventListener("click", async () => {
  await createSnapshot("Manual snapshot");
  persistState();
  renderBreadcrumbs();
  pulse(els.saveBtn, "Snapshot Saved");
});

els.clearSavesBtn.addEventListener("click", async () => {
  await clearSavedArrangements();
});

els.exportCurrentBtn.addEventListener("click", () => {
  exportLayoutsPdf();
  pulse(els.exportCurrentBtn, "Preparing PDF...");
});

els.exportTableSetupBtn.addEventListener("click", () => {
  exportTableSetupCsv();
  pulse(els.exportTableSetupBtn, "Exported CSV");
});

els.resetBtn.addEventListener("click", () => {
  if (!confirm("Reset all tables, guests, and assignments?")) return;
  Object.assign(state, structuredClone(defaultState));
  regenerateRoomTables("main", 12);
  regenerateRoomTables("overflow", 6);
  renderAll();
  persistState();
});

els.quickAddGuestBtn.addEventListener("click", () => {
  const name = els.quickGuestName.value.trim();
  if (!name) return;

  const guest = {
    id: state.nextGuestId++,
    name,
    group: els.quickGuestGroup.value.trim(),
  };
  state.guests.push(guest);

  populateGuestSelect(els.seatGuestSelect, guest.id);
  els.quickGuestName.value = "";
  els.quickGuestGroup.value = "";
  persistState();
});

els.seatForm.addEventListener("submit", (event) => {
  if (!activeSeatRef) return;
  const action = event.submitter?.value || "default";
  const roomTables = activeSeatRef.room === "main" ? state.mainTables : state.overflowTables;
  const table = roomTables.find((t) => t.id === activeSeatRef.tableId);
  if (!table) return;

  if (action === "remove") {
    table.assignments[activeSeatRef.seatIndex] = null;
  } else {
    const selectedId = Number(els.seatGuestSelect.value) || null;
    if (selectedId) clearGuestFromAnySeat(selectedId);
    table.assignments[activeSeatRef.seatIndex] = selectedId;
  }

  activeSeatRef = null;
  renderAll();
  persistState();
});

function renderAll() {
  syncControlsFromState();
  syncOverflowLayoutVisibility();
  renderTableConfig();
  renderBreadcrumbs();
  renderLayoutTableEditor();
  renderOverflowTableEditor();
  renderRoomLayout();
  renderOverflowRoomLayout();
}

function syncControlsFromState() {
  els.mainTableCount.value = state.mainTables.length;
  els.overflowTableCount.value = state.overflowTables.length;
}

function syncOverflowLayoutVisibility() {
  const hasOverflowTables = state.overflowTables.length > 0;
  if (els.overflowLayoutSection) {
    els.overflowLayoutSection.style.display = hasOverflowTables ? "" : "none";
  }
  if (els.overflowJumpBtn) {
    els.overflowJumpBtn.style.display = hasOverflowTables ? "" : "none";
  }
}

function regenerateRoomTables(room, count) {
  const current = room === "main" ? state.mainTables : state.overflowTables;
  const existing = new Map(current.map((t) => [t.id, t]));
  const newTables = [];

  for (let i = 0; i < count; i += 1) {
    const id = i + 1;
    const old = existing.get(id);
    if (old) {
      old.seatCount = clampInt(old.seatCount ?? old.assignments?.length ?? 10, MIN_SEATS, MAX_SEATS);
      old.assignments = resizeAssignments(old.assignments || [], old.seatCount);
      old.name = String(old.name || `Table ${id}`).trim() || `Table ${id}`;
      old.tableNumber = clampInt(
        old.tableNumber ?? getDisplayTableNumber(room, id),
        1,
        9999,
      );
      old.notes = String(old.notes || "");
      old.x = clampFloat(old.x, 0, 94);
      old.y = clampFloat(old.y, 8, 94);
      newTables.push(old);
      continue;
    }

    const pos = getAutoLayoutPosition(i, Math.max(count, 1));
    newTables.push({
      id,
      tableNumber: getDisplayTableNumber(room, id),
      name: `Table ${getDisplayTableNumber(room, id)}`,
      notes: "",
      seatCount: 10,
      x: clampFloat(pos.x, 3, 94),
      y: clampFloat(pos.y, 8, 94),
      assignments: Array.from({ length: 10 }, () => null),
    });
  }

  const validGuestIds = new Set(state.guests.map((g) => g.id));
  for (const table of newTables) {
    table.assignments = table.assignments.map((guestId) =>
      validGuestIds.has(guestId) ? guestId : null,
    );
  }

  if (room === "main") {
    state.mainTables = newTables;
    if (!newTables.find((t) => t.id === selectedMainTableId)) {
      selectedMainTableId = newTables[0]?.id || null;
    }
  } else {
    state.overflowTables = newTables;
    if (!newTables.find((t) => t.id === selectedOverflowTableId)) {
      selectedOverflowTableId = newTables[0]?.id || null;
    }
  }
}

function renderTableConfig() {
  els.tableConfigList.innerHTML = "";

  appendRoomConfig("Main Room", state.mainTables, "main");
  appendRoomConfig("Overflow Room", state.overflowTables, "overflow");
}

function appendRoomConfig(roomLabel, tables, roomKey) {
  for (const table of tables) {
    const displayNumber = getDisplayTableNumber(roomKey, table.id, table);
    const card = document.createElement("article");
    card.className = "table-config-card";

    const title = document.createElement("div");
    title.className = "table-config-title";
    title.textContent = `${roomLabel} · Table ${displayNumber}`;

    const grid = document.createElement("div");
    grid.className = "table-config-grid";

    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Table Name";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = table.name;
    nameInput.placeholder = `Table ${displayNumber}`;
    nameInput.addEventListener("input", () => {
      table.name = nameInput.value.trim() || `Table ${displayNumber}`;
      if (roomKey === "main") {
        renderLayoutTableEditor();
        renderRoomLayout();
      } else {
        renderOverflowTableEditor();
        renderOverflowRoomLayout();
      }
      persistState();
    });
    nameLabel.append(nameInput);

    const seatsLabel = document.createElement("label");
    seatsLabel.textContent = "Guest Count";
    const seatsInput = document.createElement("input");
    seatsInput.type = "number";
    seatsInput.min = String(MIN_SEATS);
    seatsInput.max = String(MAX_SEATS);
    seatsInput.value = String(table.seatCount);
    seatsInput.addEventListener("change", () => {
      const nextCount = clampInt(seatsInput.value, MIN_SEATS, MAX_SEATS);
      table.seatCount = nextCount;
      table.assignments = resizeAssignments(table.assignments, nextCount);
      renderAll();
      persistState();
    });
    seatsLabel.append(seatsInput);

    grid.append(nameLabel, seatsLabel);

    const notesLabel = document.createElement("label");
    notesLabel.textContent = "Table Notes";
    const notesInput = document.createElement("textarea");
    notesInput.value = table.notes;
    notesInput.placeholder = "VIP notes, relationships, seating constraints, etc.";
    notesInput.addEventListener("input", () => {
      table.notes = notesInput.value;
      persistState();
    });
    notesLabel.append(notesInput);

    card.append(title, grid, notesLabel);
    els.tableConfigList.append(card);
  }
}

function renderBreadcrumbs() {
  if (!els.breadcrumbList) return;
  els.breadcrumbList.innerHTML = "";

  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "crumb-empty";
    empty.textContent = "No saved seating arrangements yet. Use Save Snapshot to create one.";
    els.breadcrumbList.append(empty);
    return;
  }

  for (const entry of history) {
    const row = document.createElement("article");
    row.className = "crumb-row";

    const summary = document.createElement("div");
    summary.className = "crumb-summary";
    const when = new Date(entry.savedAt).toLocaleString();
    const tableCount = countTablesInSnapshot(entry.snapshot);
    const guestCount = Array.isArray(entry.snapshot?.guests) ? entry.snapshot.guests.length : 0;
    summary.innerHTML = `<strong>${escapeHtml(entry.label)}</strong><span>${escapeHtml(when)} · ${tableCount} tables · ${guestCount} guests</span>`;

    const actions = document.createElement("div");
    actions.className = "crumb-actions";

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "btn";
    restoreBtn.textContent = "Restore";
    restoreBtn.addEventListener("click", () => {
      if (!confirm(`Restore snapshot from ${when}?`)) return;
      const restored = normalizeState(entry.snapshot);
      Object.assign(state, restored);
      persistState();
      renderAll();
    });

    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "btn";
    exportBtn.textContent = "Download JSON";
    exportBtn.addEventListener("click", () => {
      downloadJson(entry.snapshot, `seat-studio-snapshot-${timestampForFile(entry.savedAt)}.json`);
    });

    actions.append(restoreBtn, exportBtn);
    row.append(summary, actions);
    els.breadcrumbList.append(row);
  }
}

function countTablesInSnapshot(snapshot) {
  const mainCount = Array.isArray(snapshot?.mainTables)
    ? snapshot.mainTables.length
    : Array.isArray(snapshot?.tables)
      ? snapshot.tables.length
      : 0;
  const overflowCount = Array.isArray(snapshot?.overflowTables) ? snapshot.overflowTables.length : 0;
  return mainCount + overflowCount;
}

function resizeAssignments(assignments, seatCount) {
  const next = assignments.slice(0, seatCount);
  while (next.length < seatCount) next.push(null);
  return next;
}

function renderRoomLayout() {
  renderLayoutCanvas({
    canvasEl: els.roomCanvas,
    tables: state.mainTables,
    doorways: state.mainDoorways,
    selectedId: selectedMainTableId,
    markerType: "main",
    onSelect: (tableId, focusEditor = false) => {
      selectedMainTableId = tableId;
      renderLayoutTableEditor(focusEditor);
      renderRoomLayout();
    },
    rerender: renderRoomLayout,
  });
}

function renderOverflowRoomLayout() {
  renderLayoutCanvas({
    canvasEl: els.overflowRoomCanvas,
    tables: state.overflowTables,
    doorways: [],
    selectedId: selectedOverflowTableId,
    markerType: "overflow",
    onSelect: (tableId, focusEditor = false) => {
      selectedOverflowTableId = tableId;
      renderOverflowTableEditor(focusEditor);
      renderOverflowRoomLayout();
    },
    rerender: renderOverflowRoomLayout,
  });
}

function renderLayoutCanvas({ canvasEl, tables, doorways, selectedId, markerType, onSelect, rerender }) {
  if (!canvasEl) return;
  canvasEl.innerHTML = "";

  if (markerType === "main") {
    const stage = document.createElement("div");
    stage.className = "stage-marker";
    stage.textContent = "STAGE";

    const leftDisplay = document.createElement("div");
    leftDisplay.className = "display-marker left";
    leftDisplay.textContent = "TV DISPLAY";

    const rightDisplay = document.createElement("div");
    rightDisplay.className = "display-marker right";
    rightDisplay.textContent = "TV DISPLAY";

    canvasEl.append(stage, leftDisplay, rightDisplay);

    for (const doorway of doorways) {
      const doorwayNode = document.createElement("div");
      doorwayNode.className = "doorway-node";
      doorwayNode.style.left = `${doorway.x}%`;
      doorwayNode.style.top = `${doorway.y}%`;
      doorwayNode.textContent = doorway.label;
      doorwayNode.addEventListener("mousedown", (event) =>
        startDrag(event, doorway, { canvasEl, rerender, minYPercent: 0 }),
      );
      canvasEl.append(doorwayNode);
    }
  } else {
    const display = document.createElement("div");
    display.className = "overflow-display-marker";
    display.textContent = "LARGE DISPLAY";

    const leftDoor = document.createElement("div");
    leftDoor.className = "door-marker left";
    leftDoor.textContent = "DOOR TO MAIN ROOM";

    const rightDoor = document.createElement("div");
    rightDoor.className = "door-marker right";
    rightDoor.textContent = "DOOR TO MAIN ROOM";

    canvasEl.append(display, leftDoor, rightDoor);
  }

  for (const table of tables) {
    const roomKey = markerType === "main" ? "main" : "overflow";
    const displayNumber = getDisplayTableNumber(roomKey, table.id, table);
    const tableNode = document.createElement("div");
    tableNode.className = "table-node";
    if (table.id === selectedId) tableNode.classList.add("selected");

    tableNode.style.left = `${table.x}%`;
    tableNode.style.top = `${table.y}%`;
    tableNode.dataset.tableId = String(table.id);

    const tag = document.createElement("span");
    tag.className = "table-tag";
    const shortName = table.name.length > 11 ? `${table.name.slice(0, 10)}...` : table.name;
    tag.innerHTML = `${displayNumber}<span class="table-name">${escapeHtml(shortName)}</span><span class="table-guests">${table.seatCount}</span>`;
    tableNode.append(tag);

    tableNode.addEventListener("mousedown", (event) =>
      startDrag(event, table, { canvasEl, rerender }),
    );
    tableNode.addEventListener("click", (event) => {
      if (event.target.classList.contains("seat-dot")) return;
      if (didDrag) return;
      onSelect(table.id);
    });
    tableNode.addEventListener("dblclick", (event) => {
      if (event.target.classList.contains("seat-dot")) return;
      onSelect(table.id, true);
    });

    table.assignments.forEach((guestId, seatIndex) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = `seat-dot ${guestId ? "occupied" : ""}`;
      dot.title = seatTitle(table, seatIndex, guestId);
      dot.textContent = String(seatIndex + 1);

      const angle = (Math.PI * 2 * seatIndex) / table.assignments.length;
      const radius = 58;
      const offsetX = 46 + Math.cos(angle) * radius - 9;
      const offsetY = 46 + Math.sin(angle) * radius - 9;

      dot.style.left = `${offsetX}px`;
      dot.style.top = `${offsetY}px`;

      tableNode.append(dot);
    });

    canvasEl.append(tableNode);
  }
}

function startDrag(event, targetEntity, dragOptions) {
  if (event.target.classList.contains("seat-dot")) return;

  const canvasRect = dragOptions.canvasEl.getBoundingClientRect();
  const node = event.currentTarget;
  const nodeRect = node.getBoundingClientRect();

  dragging = {
    targetEntity,
    canvasRect,
    rerender: dragOptions.rerender,
    deltaX: event.clientX - nodeRect.left,
    deltaY: event.clientY - nodeRect.top,
    itemWidth: nodeRect.width,
    itemHeight: nodeRect.height,
    minYPercent: typeof dragOptions.minYPercent === "number" ? dragOptions.minYPercent : 8,
  };
  didDrag = false;

  window.addEventListener("mousemove", onDragMove);
  window.addEventListener("mouseup", onDragEnd, { once: true });
}

function onDragMove(event) {
  if (!dragging) return;

  const xPx = event.clientX - dragging.canvasRect.left - dragging.deltaX;
  const yPx = event.clientY - dragging.canvasRect.top - dragging.deltaY;

  const maxX = Math.max(1, dragging.canvasRect.width - dragging.itemWidth);
  const maxY = Math.max(1, dragging.canvasRect.height - dragging.itemHeight);

  const left = clampFloat((xPx / maxX) * 94, 0, 94);
  const top = clampFloat((yPx / maxY) * 94, dragging.minYPercent, 94);

  dragging.targetEntity.x = left;
  dragging.targetEntity.y = top;
  didDrag = true;
  dragging.rerender();
}

function onDragEnd() {
  window.removeEventListener("mousemove", onDragMove);
  dragging = null;
  persistState();
  setTimeout(() => {
    didDrag = false;
  }, 0);
}

function renderLayoutTableEditor(focusName = false) {
  if (!els.layoutTableEditor) return;

  let table = state.mainTables.find((item) => item.id === selectedMainTableId);
  if (!table) {
    table = state.mainTables[0] || null;
    selectedMainTableId = table ? table.id : null;
  }

  els.layoutTableEditor.innerHTML = "";
  if (!table) return;

  const card = document.createElement("article");
  card.className = "layout-editor-card";

  const heading = document.createElement("h3");
  heading.textContent = `Editing ${table.name}`;

  const grid = document.createElement("div");
  grid.className = "layout-editor-grid";

  const numberLabel = document.createElement("label");
  numberLabel.textContent = "Table Number";
  const numberInput = document.createElement("input");
  numberInput.type = "number";
  numberInput.min = "1";
  numberInput.max = "9999";
  numberInput.value = String(getDisplayTableNumber("main", table.id, table));
  numberInput.addEventListener("input", () => {
    const typed = Number.parseInt(numberInput.value, 10);
    if (Number.isNaN(typed)) return;
    table.tableNumber = clampInt(typed, 1, 9999);
    renderTableConfig();
    renderRoomLayout();
    persistState();
  });
  numberInput.addEventListener("blur", () => {
    table.tableNumber = clampInt(numberInput.value, 1, 9999);
    numberInput.value = String(table.tableNumber);
  });
  numberLabel.append(numberInput);

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Table Name";
  const nameInput = document.createElement("input");
  const displayNumber = getDisplayTableNumber("main", table.id, table);
  nameInput.type = "text";
  nameInput.value = table.name;
  nameInput.placeholder = `Table ${displayNumber}`;
  nameInput.addEventListener("input", () => {
    table.name = nameInput.value.trim() || `Table ${displayNumber}`;
    heading.textContent = `Editing ${table.name}`;
    renderTableConfig();
    renderOverflowTableEditor();
    renderRoomLayout();
    renderOverflowRoomLayout();
    persistState();
  });
  nameLabel.append(nameInput);
  mainEditorNameInput = nameInput;

  grid.append(numberLabel, nameLabel);
  card.append(heading, grid);
  els.layoutTableEditor.append(card);

  if (focusName && mainEditorNameInput) {
    mainEditorNameInput.focus();
    mainEditorNameInput.select();
  }
}

function renderOverflowTableEditor(focusName = false) {
  if (!els.overflowTableEditor) return;

  let table = state.overflowTables.find((item) => item.id === selectedOverflowTableId);
  if (!table) {
    table = state.overflowTables[0] || null;
    selectedOverflowTableId = table ? table.id : null;
  }

  els.overflowTableEditor.innerHTML = "";
  if (!table) return;

  const card = document.createElement("article");
  card.className = "layout-editor-card";

  const heading = document.createElement("h3");
  heading.textContent = `Editing ${table.name}`;

  const grid = document.createElement("div");
  grid.className = "layout-editor-grid";

  const numberLabel = document.createElement("label");
  numberLabel.textContent = "Table Number";
  const numberInput = document.createElement("input");
  numberInput.type = "number";
  numberInput.min = "1";
  numberInput.max = "9999";
  numberInput.value = String(getDisplayTableNumber("overflow", table.id, table));
  numberInput.addEventListener("input", () => {
    const typed = Number.parseInt(numberInput.value, 10);
    if (Number.isNaN(typed)) return;
    table.tableNumber = clampInt(typed, 1, 9999);
    renderTableConfig();
    renderOverflowRoomLayout();
    persistState();
  });
  numberInput.addEventListener("blur", () => {
    table.tableNumber = clampInt(numberInput.value, 1, 9999);
    numberInput.value = String(table.tableNumber);
  });
  numberLabel.append(numberInput);

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Table Name";
  const nameInput = document.createElement("input");
  const displayNumber = getDisplayTableNumber("overflow", table.id, table);
  nameInput.type = "text";
  nameInput.value = table.name;
  nameInput.placeholder = `Table ${displayNumber}`;
  nameInput.addEventListener("input", () => {
    table.name = nameInput.value.trim() || `Table ${displayNumber}`;
    heading.textContent = `Editing ${table.name}`;
    renderTableConfig();
    renderLayoutTableEditor();
    renderRoomLayout();
    renderOverflowRoomLayout();
    persistState();
  });
  nameLabel.append(nameInput);
  overflowEditorNameInput = nameInput;

  grid.append(numberLabel, nameLabel);
  card.append(heading, grid);
  els.overflowTableEditor.append(card);

  if (focusName && overflowEditorNameInput) {
    overflowEditorNameInput.focus();
    overflowEditorNameInput.select();
  }
}

function openSeatDialog(room, tableId, seatIndex) {
  const tables = room === "main" ? state.mainTables : state.overflowTables;
  const table = tables.find((t) => t.id === tableId);
  if (!table) return;

  activeSeatRef = { room, tableId, seatIndex };
  const guestId = table.assignments[seatIndex];

  els.seatDialogTitle.textContent = `${table.name} · Seat ${seatIndex + 1}`;
  populateGuestSelect(els.seatGuestSelect, guestId);
  els.removeSeatBtn.disabled = !guestId;
  els.quickGuestName.value = "";
  els.quickGuestGroup.value = "";
  els.seatDialog.showModal();
}

function populateGuestSelect(selectEl, selectedGuestId) {
  selectEl.innerHTML = "";

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "-- Empty Seat --";
  selectEl.append(blank);

  const assignedIds = new Set(allAssignedGuestIds());
  if (selectedGuestId) assignedIds.delete(selectedGuestId);

  for (const guest of state.guests) {
    if (assignedIds.has(guest.id)) continue;
    const option = document.createElement("option");
    option.value = String(guest.id);
    option.textContent = guest.group ? `${guest.name} (${guest.group})` : guest.name;
    selectEl.append(option);
  }

  selectEl.value = selectedGuestId ? String(selectedGuestId) : "";
}

function clearGuestFromAnySeat(guestId) {
  for (const table of [...state.mainTables, ...state.overflowTables]) {
    const idx = table.assignments.findIndex((id) => id === guestId);
    if (idx >= 0) table.assignments[idx] = null;
  }
}

function allAssignedGuestIds() {
  return [...state.mainTables, ...state.overflowTables].flatMap((table) => table.assignments.filter(Boolean));
}

function seatTitle(table, seatIndex, guestId) {
  if (!guestId) return `${table.name} Seat ${seatIndex + 1}: Empty`;
  const guest = state.guests.find((g) => g.id === guestId);
  return `${table.name} Seat ${seatIndex + 1}: ${guest ? guest.name : "Unknown"}`;
}

function loadState() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem("black-tie-seating-v2") ||
      localStorage.getItem("black-tie-seating-v1");
    if (!raw) return structuredClone(defaultState);

    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return structuredClone(defaultState);
  }
}

function persistState(options = {}) {
  const { sync = true } = options;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (sync) queueCloudSync();
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 25);
  } catch {
    return [];
  }
}

function persistHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function sanitizeRoomCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 60);
}

function getRoomCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return sanitizeRoomCode(params.get("room") || "main");
}

async function connectCollabFromLink() {
  const roomCode = getRoomCodeFromUrl();
  const { supabaseUrl, supabaseAnonKey } = SHARED_CONFIG;
  if (!roomCode || !supabaseUrl || !supabaseAnonKey) return;
  if (!window.supabase?.createClient) return;

  try {
    collab.client = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    collab.roomCode = roomCode;
    const hasRemoteState = await fetchStateFromCloud();
    if (!hasRemoteState) {
      await ensureRoomExists();
    }
    await fetchHistoryFromCloud();
    subscribeToRoom();
    collab.connected = true;
  } catch (error) {
    console.error("Collaboration connect failed:", error);
    collab.client = null;
    collab.connected = false;
  }
}

async function ensureRoomExists() {
  if (!collab.client) return;
  const payload = normalizeState(structuredClone(state));
  const { error } = await collab.client.from("seat_studio_rooms").upsert(
    {
      code: collab.roomCode,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "code" },
  );
  if (error) throw error;
}

async function fetchStateFromCloud() {
  if (!collab.client) return;
  const { data, error } = await collab.client
    .from("seat_studio_rooms")
    .select("payload")
    .eq("code", collab.roomCode)
    .maybeSingle();
  if (error) throw error;
  if (!data?.payload) return false;
  applyRemoteState(data.payload);
  return true;
}

function subscribeToRoom() {
  if (!collab.client) return;
  collab.channel = collab.client
    .channel(`seat-studio-${collab.roomCode}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "seat_studio_rooms",
        filter: `code=eq.${collab.roomCode}`,
      },
      (payload) => {
        const remotePayload = payload?.new?.payload;
        if (!remotePayload) return;
        applyRemoteState(remotePayload);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "seat_studio_versions",
        filter: `room_code=eq.${collab.roomCode}`,
      },
      () => {
        fetchHistoryFromCloud();
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") fetchHistoryFromCloud();
    });
}

function applyRemoteState(remotePayload) {
  collab.applyingRemote = true;
  const restored = normalizeState(remotePayload);
  Object.assign(state, restored);
  persistState({ sync: false });
  renderAll();
  collab.applyingRemote = false;
}

function queueCloudSync() {
  if (!collab.connected || collab.applyingRemote) return;
  if (collab.stateSyncTimer) clearTimeout(collab.stateSyncTimer);
  collab.stateSyncTimer = setTimeout(() => {
    uploadStateToCloud();
  }, 220);
}

async function uploadStateToCloud() {
  if (!collab.connected || !collab.client) return;
  const payload = normalizeState(structuredClone(state));
  const { error } = await collab.client.from("seat_studio_rooms").upsert(
    {
      code: collab.roomCode,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "code" },
  );
  if (error) console.error("Realtime sync failed:", error);
}

async function fetchHistoryFromCloud() {
  if (!collab.client || !collab.roomCode) return;
  const { data, error } = await collab.client
    .from("seat_studio_versions")
    .select("id,label,snapshot,created_at")
    .eq("room_code", collab.roomCode)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) {
    console.error("History fetch failed:", error);
    return;
  }
  history = data.map((item) => ({
    id: String(item.id),
    label: String(item.label || "Snapshot"),
    savedAt: item.created_at,
    snapshot: item.snapshot,
  }));
  renderBreadcrumbs();
}

async function createSnapshot(label) {
  const snapshot = structuredClone(state);
  if (collab.connected && collab.client) {
    const { error } = await collab.client.from("seat_studio_versions").insert({
      room_code: collab.roomCode,
      label,
      snapshot,
    });
    if (error) {
      console.error("Snapshot save failed:", error);
      return;
    }
    await fetchHistoryFromCloud();
    return;
  }

  history = [
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      label,
      savedAt: new Date().toISOString(),
      snapshot,
    },
    ...history,
  ].slice(0, 25);
  persistHistory();
}

async function clearSavedArrangements() {
  if (!confirm("Clear all saved seating arrangements? This cannot be undone.")) return;

  if (collab.connected && collab.client && collab.roomCode) {
    const { error } = await collab.client
      .from("seat_studio_versions")
      .delete()
      .eq("room_code", collab.roomCode);
    if (error) {
      console.error("Clear shared history failed:", error);
      return;
    }
    history = [];
    renderBreadcrumbs();
    pulse(els.clearSavesBtn, "Cleared");
    return;
  }

  history = [];
  persistHistory();
  renderBreadcrumbs();
  pulse(els.clearSavesBtn, "Cleared");
}

function normalizeState(rawState) {
  const rawMain = Array.isArray(rawState.mainTables)
    ? rawState.mainTables
    : Array.isArray(rawState.tables)
      ? rawState.tables
      : [];
  const rawOverflow = Array.isArray(rawState.overflowTables) ? rawState.overflowTables : [];
  const guests = Array.isArray(rawState.guests) ? rawState.guests : [];
  const rawDoorways = Array.isArray(rawState.mainDoorways) ? rawState.mainDoorways : [];
  const seatFallback = clampInt(rawState.seatsPerTable ?? 10, MIN_SEATS, MAX_SEATS);

  const normalizeTables = (tables) =>
    tables.map((table, idx) => {
      const id = clampInt(table.id ?? idx + 1, 1, 1000);
      const seatCount = clampInt(table.seatCount ?? table.assignments?.length ?? seatFallback, MIN_SEATS, MAX_SEATS);
      const autoPos = getAutoLayoutPosition(idx, Math.max(tables.length, 1));
      const roomKey = tables === rawMain ? "main" : "overflow";
      return {
        id,
        tableNumber: clampInt(
          table.tableNumber ?? getDisplayTableNumber(roomKey, id),
          1,
          9999,
        ),
        name: String(table.name || `Table ${id}`).trim() || `Table ${id}`,
        notes: String(table.notes || ""),
        x: clampFloat(table.x ?? autoPos.x, 0, 94),
        y: clampFloat(table.y ?? autoPos.y, 8, 94),
        seatCount,
        assignments: resizeAssignments(Array.isArray(table.assignments) ? table.assignments : [], seatCount),
      };
    });

  return {
    mainTables: normalizeTables(rawMain),
    overflowTables: normalizeTables(rawOverflow),
    mainDoorways: normalizeDoorways(rawDoorways),
    guests: guests.map((guest, idx) => ({
      id: clampInt(guest.id ?? idx + 1, 1, Number.MAX_SAFE_INTEGER),
      name: String(guest.name || "").trim(),
      group: String(guest.group || ""),
    })),
    nextGuestId: clampInt(rawState.nextGuestId ?? guests.length + 1, 1, Number.MAX_SAFE_INTEGER),
  };
}

function getDefaultMainDoorways() {
  return [
    { id: "door-1", label: "DOORWAY 1", x: 10, y: 84 },
    { id: "door-2", label: "DOORWAY 2", x: 74, y: 84 },
  ];
}

function normalizeDoorways(rawDoorways) {
  const defaults = getDefaultMainDoorways();
  if (!Array.isArray(rawDoorways) || !rawDoorways.length) return defaults;
  return defaults.map((fallback, idx) => {
    const source = rawDoorways[idx] || {};
    return {
      id: String(source.id || fallback.id),
      label: String(source.label || fallback.label),
      x: clampFloat(source.x ?? fallback.x, 0, 94),
      y: clampFloat(source.y ?? fallback.y, 0, 94),
    };
  });
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadCsv(rows, filename) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function exportTableSetupCsv() {
  const rows = [["Room", "Table Number", "Table Name", "Guest Count", "Notes"]];
  for (const table of state.mainTables) {
    rows.push([
      "Main Room",
      getDisplayTableNumber("main", table.id, table),
      table.name || "",
      table.seatCount,
      table.notes || "",
    ]);
  }
  for (const table of state.overflowTables) {
    rows.push([
      "Overflow Room",
      getDisplayTableNumber("overflow", table.id, table),
      table.name || "",
      table.seatCount,
      table.notes || "",
    ]);
  }
  downloadCsv(rows, `seat-studio-table-setup-${timestampForFile()}.csv`);
}

function timestampForFile(dateString = null) {
  const date = dateString ? new Date(dateString) : new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}${m}${d}-${hh}${mm}`;
}

function pulse(button, message) {
  const old = button.textContent;
  button.textContent = message;
  setTimeout(() => {
    button.textContent = old;
  }, 900);
}

function exportLayoutsPdf() {
  document.body.classList.add("print-layouts-only");
  window.print();
  setTimeout(() => {
    document.body.classList.remove("print-layouts-only");
  }, 220);
}

window.addEventListener("afterprint", () => {
  document.body.classList.remove("print-layouts-only");
});

function clampInt(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function clampFloat(value, min, max) {
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function getAutoLayoutPosition(index, count) {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const col = Math.floor(index / rows);
  const row = index % rows;

  return {
    x: 14 + col * 16,
    y: 16 + row * 18,
  };
}

function getDisplayTableNumber(room, localId, table = null) {
  const asNumber =
    table && Number.isFinite(Number(table.tableNumber))
      ? clampInt(table.tableNumber, 1, 9999)
      : null;
  if (asNumber) return asNumber;
  if (room === "main") return localId;
  return state.mainTables.length + localId;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
