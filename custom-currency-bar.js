const MODULE_ID = "custom-currency-bar";
const SETTING = "currencies";

const duplicate = foundry.utils.deepClone;

function randomId() {
  return foundry.utils.randomID();
}

function getCurrencies() {
  const value = game.settings.get(MODULE_ID, SETTING);
  return Array.isArray(value) ? value : [];
}

function esc(value = "") {
  return foundry.utils.escapeHTML(String(value));
}

function quantityOf(item) {
  return Number(foundry.utils.getProperty(item, "system.quantity")) || 0;
}

function sourceIdOf(item) {
  return item.getFlag("core", "sourceId") ?? item._stats?.compendiumSource ?? null;
}

function findCurrencyItem(actor, currency) {
  return actor.items.find(item => item.getFlag(MODULE_ID, "currencyId") === currency.id)
    ?? actor.items.find(item => currency.uuid && (item.uuid === currency.uuid || sourceIdOf(item) === currency.uuid))
    ?? actor.items.find(item => item.name === currency.name && (!currency.itemType || item.type === currency.itemType));
}

async function setCurrencyValue(actor, currency, rawValue) {
  if (!actor.isOwner) return;
  const value = Math.max(0, Math.floor(Number(rawValue) || 0));

  if (currency.mode === "virtual") {
    const values = duplicate(actor.getFlag(MODULE_ID, "values") ?? {});
    values[currency.id] = value;
    await actor.setFlag(MODULE_ID, "values", values);
    return;
  }

  const item = findCurrencyItem(actor, currency);
  if (item) {
    await item.update({ "system.quantity": value });
    return;
  }
  if (value === 0) return;

  const source = currency.uuid ? await fromUuid(currency.uuid) : null;
  if (!source || source.documentName !== "Item") {
    ui.notifications.warn(game.i18n.format("CCB.SourceMissing", { name: currency.name }));
    return;
  }
  const data = source.toObject();
  delete data._id;
  foundry.utils.setProperty(data, "system.quantity", value);
  foundry.utils.setProperty(data, `flags.${MODULE_ID}.currencyId`, currency.id);
  await actor.createEmbeddedDocuments("Item", [data]);
}

class CurrencyConfig extends FormApplication {
  constructor(...args) {
    super(...args);
    this.currencies = duplicate(getCurrencies());
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "custom-currency-bar-config",
      title: game.i18n.localize("CCB.ConfigTitle"),
      template: `modules/${MODULE_ID}/templates/currency-config.hbs`,
      width: 720,
      height: "auto",
      closeOnSubmit: false,
      submitOnChange: false,
      dragDrop: [{ dropSelector: ".ccb-drop-zone" }]
    });
  }

  getData() {
    return { currencies: this.currencies };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-action='add']").on("click", () => {
      this.currencies.push({ id: randomId(), name: "New Currency", img: "icons/commodities/currency/coin-embossed-crown-gold.webp", mode: "virtual", uuid: "", itemType: "" });
      this.render(false);
    });
    html.find("[data-action='delete']").on("click", event => {
      const index = Number(event.currentTarget.closest(".ccb-config-row").dataset.index);
      this.currencies.splice(index, 1);
      this.render(false);
    });
    html.find("[data-action='up'], [data-action='down']").on("click", event => {
      const row = event.currentTarget.closest(".ccb-config-row");
      const from = Number(row.dataset.index);
      const to = event.currentTarget.dataset.action === "up" ? from - 1 : from + 1;
      if (to < 0 || to >= this.currencies.length) return;
      this._capture(html);
      [this.currencies[from], this.currencies[to]] = [this.currencies[to], this.currencies[from]];
      this.render(false);
    });
  }

  _capture(html) {
    for (const row of html[0].querySelectorAll(".ccb-config-row")) {
      const currency = this.currencies[Number(row.dataset.index)];
      if (!currency) continue;
      currency.name = row.querySelector("[data-field='name']")?.value.trim() || "Currency";
      currency.img = row.querySelector("[data-field='img']")?.value.trim() || currency.img;
    }
  }

  async _onDrop(event) {
    const row = event.target.closest(".ccb-config-row");
    if (!row) return;
    let data;
    try { data = TextEditor.getDragEventData(event); } catch (_) { return; }
    const item = data.uuid ? await fromUuid(data.uuid) : null;
    if (!item || item.documentName !== "Item") {
      ui.notifications.warn(game.i18n.localize("CCB.DropItemOnly"));
      return;
    }
    this._capture(this.element);
    const currency = this.currencies[Number(row.dataset.index)];
    Object.assign(currency, { name: item.name, img: item.img, mode: "item", uuid: item.uuid, itemType: item.type });
    this.render(false);
  }

  async _updateObject(_event, formData) {
    const expanded = foundry.utils.expandObject(formData);
    for (let i = 0; i < this.currencies.length; i++) {
      const submitted = expanded.currencies?.[i];
      if (!submitted) continue;
      this.currencies[i].name = submitted.name?.trim() || "Currency";
      this.currencies[i].img = submitted.img?.trim() || "icons/svg/coins.svg";
    }
    await game.settings.set(MODULE_ID, SETTING, this.currencies);
    ui.notifications.info(game.i18n.localize("CCB.Saved"));
    for (const app of Object.values(ui.windows)) {
      if (app.actor) app.render(false);
    }
  }
}

function sheetRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

function renderCurrencies(app, html) {
  const actor = app.actor ?? app.document;
  if (!actor || actor.documentName !== "Actor" || !["character", "npc"].includes(actor.type)) return;
  const currencies = getCurrencies();
  if (!currencies.length) return;
  const root = sheetRoot(html);
  if (!root || root.querySelector(".ccb-currency-bar")) return;

  const values = actor.getFlag(MODULE_ID, "values") ?? {};
  const bar = document.createElement("section");
  bar.className = "ccb-currency-bar";
  bar.innerHTML = `<div class="ccb-heading">${esc(game.i18n.localize("CCB.CustomCurrency"))}</div><div class="ccb-currencies"></div>`;
  const list = bar.querySelector(".ccb-currencies");

  for (const currency of currencies) {
    const item = currency.mode === "item" ? findCurrencyItem(actor, currency) : null;
    const value = currency.mode === "item" ? quantityOf(item) : (Number(values[currency.id]) || 0);
    const control = document.createElement("label");
    control.className = "ccb-currency";
    control.title = currency.mode === "item" ? `${currency.name} (inventory item)` : currency.name;
    control.innerHTML = `<img src="${esc(currency.img)}" alt=""><span>${esc(currency.name)}</span><input type="number" min="0" step="1" value="${value}" aria-label="${esc(currency.name)}" ${actor.isOwner ? "" : "disabled"}>`;
    control.querySelector("input").addEventListener("change", async event => {
      event.stopPropagation();
      await setCurrencyValue(actor, currency, event.currentTarget.value);
    });
    list.append(control);
  }

  const anchor = root.querySelector(".currency")
    ?? root.querySelector("[data-group='currency']")
    ?? root.querySelector("[data-tab='inventory'] .inventory-element")
    ?? root.querySelector("[data-tab='inventory']")
    ?? root.querySelector(".sheet-body");
  if (!anchor) return;
  if (anchor.matches(".currency, [data-group='currency']")) {
    bar.classList.add("ccb-inline");
    bar.querySelector(".ccb-heading")?.remove();
    anchor.append(bar);
  } else anchor.prepend(bar);
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING, {
    scope: "world",
    config: false,
    type: Array,
    default: []
  });
  game.settings.registerMenu(MODULE_ID, "currencyConfig", {
    name: "CCB.ConfigName",
    label: "CCB.ConfigButton",
    hint: "CCB.ConfigHint",
    icon: "fa-solid fa-coins",
    type: CurrencyConfig,
    restricted: true
  });
});

Hooks.on("renderActorSheet", renderCurrencies);
Hooks.on("renderActorSheetV2", renderCurrencies);
Hooks.on("updateItem", item => {
  if (item.parent?.documentName === "Actor") item.parent.sheet?.render(false);
});

Hooks.once("ready", () => {
  if (game.system.id !== "dnd5e") ui.notifications.error(game.i18n.localize("CCB.Dnd5eOnly"));
});
