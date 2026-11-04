// WayneOS Tasks — Zero-clutter 3-task queue (FR-4.x)
import { storage } from "./storage.js";

const MAX_TASKS = 3;

export class TaskQueue {
  constructor({ onUpdate }) {
    this.onUpdate = onUpdate;
    this.tasks    = storage.get("tasks:queue", []);
  }

  get activeCount() {
    return this.tasks.filter(t => !t.done).length;
  }

  get canAdd() {
    return this.activeCount < MAX_TASKS;
  }

  add(text) {
    if (!text.trim()) return false;
    if (this.activeCount >= MAX_TASKS) return false;

    this.tasks.push({
      id:        Date.now(),
      text:      text.trim(),
      done:      false,
      createdAt: Date.now(),
    });

    this._persist();
    this.onUpdate(this.tasks);
    return true;
  }

  toggle(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    task.done      = !task.done;
    task.completedAt = task.done ? Date.now() : null;
    this._persist();
    this.onUpdate(this.tasks);
  }

  remove(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this._persist();
    this.onUpdate(this.tasks);
  }

  updateText(id, text) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.text = text.trim();
      this._persist();
    }
  }

  clearDone() {
    this.tasks = this.tasks.filter(t => !t.done);
    this._persist();
    this.onUpdate(this.tasks);
  }

  _persist() {
    storage.set("tasks:queue", this.tasks);
  }

  get MAX() { return MAX_TASKS; }
}
