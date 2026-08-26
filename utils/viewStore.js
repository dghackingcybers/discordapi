import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const VIEWS_FILE = path.join(DATA_DIR, "views.json");

let cache = null;

function loadViews() {
  if (cache) return cache;

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(VIEWS_FILE)) {
      cache = JSON.parse(fs.readFileSync(VIEWS_FILE, "utf8")) || {};
      return cache;
    }
  } catch {
    // recria
  }

  cache = {};
  return cache;
}

function saveViews() {
  if (!cache) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(VIEWS_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.warn("⚠️ [ViewStore] Falha ao salvar:", error.message);
  }
}

function normalizeId(userId) {
  return String(userId || "").trim();
}

function getViews(userId) {
  const id = normalizeId(userId);
  if (!id) return 0;
  const store = loadViews();
  const value = Number(store[id] ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function setViews(userId, amount) {
  const id = normalizeId(userId);
  if (!id) return 0;

  const store = loadViews();
  const next = Math.max(0, Math.floor(Number(amount) || 0));
  store[id] = next;
  saveViews();
  return next;
}

function incrementViews(userId, by = 1) {
  const id = normalizeId(userId);
  if (!id) return 0;

  const delta = Math.floor(Number(by) || 0);
  if (!delta) return getViews(id);

  const store = loadViews();
  const current = getViews(id);
  const next = Math.max(0, current + delta);
  store[id] = next;
  saveViews();
  return next;
}

function adjustViews(userId, { action = "add", amount = 1 } = {}) {
  const qty = Math.abs(Math.floor(Number(amount) || 0));
  const act = String(action || "add").toLowerCase();

  if (act === "set" || act === "definir") {
    return setViews(userId, Number(amount) || 0);
  }

  if (act === "remove" || act === "remover" || act === "sub" || act === "-") {
    return incrementViews(userId, -qty);
  }

  // add / adicionar
  return incrementViews(userId, qty || 1);
}

export {
  getViews,
  setViews,
  incrementViews,
  adjustViews,
};
