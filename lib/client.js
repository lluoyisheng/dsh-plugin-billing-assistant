/**
 * Client half of `dsh-plugin-billing-assistant` (计费助手).
 *
 * Contributes two things to the DSH Web GUI:
 *
 *   1. A compact block in the sidebar foot (seat `sidebar.footer.action`, the
 *      bottom-left of the window, directly above Settings) showing the DeepSeek
 *      account balance, whether the current instant is a peak (峰价) or off-peak
 *      (谷价) billing period — which links to the official pricing page — and the
 *      token consumption with an estimated cost, which opens the usage panel.
 *   2. A main panel (`usage-cost`) listing every directory and conversation with
 *      its token consumption and estimated cost.
 *
 * Bundle format: a prebuilt classic script registering a CJS factory through
 * `window.__ModuleLoader__.load`, exactly like the shipped client plugins. Only
 * platform seed words may be `require`d (react, react/jsx-runtime,
 * @deepseek-ai/dsh-client-ui-primitives), so this file needs no build step.
 *
 * Data sources (all verified against the shipped packages):
 *   - balance:      remote namespace service `remote.account` (`getState`, `getBalance`)
 *   - token usage:  session projection `tokenUsage` (dsh-token-meter) via
 *                   `ctx.sessions.refreshProjections(id)` and the sessions
 *                   catalog snapshot (`byId[id].projectionValues`)
 *   - sessions:     `ctx.sessions.list` snapshot (`ids`, `byId[id].displayTitle`, `cwd`)
 *   - directories:  the session `cwd`, titled by `ctx.workspaces.list` when the
 *                   folder is a registered workspace
 */
window.__ModuleLoader__.load({
	id: "dsh-plugin-billing-assistant",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const react = require("react");
		const { jsx, jsxs } = require("react/jsx-runtime");
		const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		const Tooltip = primitives !== null && typeof primitives === "object" ? primitives.Tooltip : undefined;
		const Button = primitives !== null && typeof primitives === "object" ? primitives.Button : undefined;
		const StateDot = primitives !== null && typeof primitives === "object" ? primitives.StateDot : undefined;

		//#region styles
		const css = [
			/* --- footer block --- */
			".dshBt_card{box-sizing:border-box;display:flex;flex-direction:column;gap:4px;width:100%;min-width:0;margin:0;padding:8px 10px;font:inherit;font-size:12px;line-height:18px;text-align:left;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md)}",
			// The sidebar foot row is a flex ROW shared with the shipped Cordis badge,
			// which claims width:100% and never shrinks; without wrapping this card
			// would be squeezed to zero width. Wrapping keeps every occupant at full
			// width on its own line (this card sits directly above the Settings row).
			"div:has(> .dshBt_card),div:has(> .dshBt_badge){flex-wrap:wrap;align-items:stretch}",
			".dshBt_row{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-width:0}",
			// Row-as-control resets: the billing-period row is the official-source link
			// and the usage row is the usage-panel entry.
			".dshBt_rowLink,.dshBt_rowButton{box-sizing:border-box;margin:0;padding:2px 4px;border-radius:var(--dsw-radius-sm);background:0 0;border:none;font:inherit;color:inherit;text-align:left;width:100%;cursor:pointer;appearance:none;text-decoration:none;text-underline-offset:2px}",
			".dshBt_rowLink:hover,.dshBt_rowButton:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshBt_rowLink:focus-visible,.dshBt_rowButton:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-alias-brand-primary);outline-offset:1px}",
			".dshBt_rowLink:hover .dshBt_label{text-decoration:underline}",
			".dshBt_source,.dshBt_chevron{flex:none;color:var(--dsw-alias-label-tertiary)}",
			".dshBt_labelButton{display:inline-flex;align-items:baseline;gap:2px}",
			".dshBt_label{flex:none;color:var(--dsw-alias-label-secondary)}",
			".dshBt_value{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-variant-numeric:tabular-nums;font-weight:500}",
			".dshBt_bonus{flex:none;margin-left:4px;font-weight:400;font-size:11px;color:var(--dsw-alias-label-secondary)}",
			".dshBt_tariff{display:inline-flex;align-items:center;gap:5px;min-width:0}",
			".dshBt_dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-idle-primary)}",
			".dshBt_peak .dshBt_dot{background:var(--dsw-alias-state-warn-primary)}",
			".dshBt_valley .dshBt_dot{background:var(--dsw-alias-state-success-primary)}",
			".dshBt_name{flex:none;font-weight:500}",
			".dshBt_peak .dshBt_name{color:var(--dsw-alias-state-warn-primary)}",
			".dshBt_valley .dshBt_name{color:var(--dsw-alias-state-success-primary)}",
			".dshBt_note{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-secondary)}",
			".dshBt_detail{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:11px;color:var(--dsw-alias-label-tertiary)}",
			".dshBt_badge{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin:0;padding:0;background:transparent;border:none;border-radius:50%;cursor:pointer;appearance:none}",
			".dshBt_badge:hover{background:var(--dsw-alias-bg-layer-2)}",
			".dshBt_badge:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-alias-brand-primary);outline-offset:1px}",
			".dshBt_badgeDot{width:9px;height:9px;border-radius:50%;background:var(--dsw-alias-state-idle-primary)}",
			".dshBt_badgePeak .dshBt_badgeDot{background:var(--dsw-alias-state-warn-primary)}",
			".dshBt_badgeValley .dshBt_badgeDot{background:var(--dsw-alias-state-success-primary)}",
			/* --- usage panel --- */
			".dshUsage_root{box-sizing:border-box;display:flex;flex-direction:column;height:100%;min-height:0;padding:20px 24px 28px;gap:14px;color:var(--dsw-alias-label-primary);overflow-y:auto}",
			".dshUsage_header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}",
			".dshUsage_title{font-size:16px;font-weight:500;line-height:24px}",
			".dshUsage_headerEnd{display:inline-flex;align-items:center;gap:10px;min-width:0}",
			".dshUsage_tariff{display:inline-flex;align-items:center;gap:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}",
			".dshUsage_tariffDot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-state-idle-primary)}",
			".dshUsage_peak .dshUsage_tariffDot{background:var(--dsw-alias-state-warn-primary)}",
			".dshUsage_valley .dshUsage_tariffDot{background:var(--dsw-alias-state-success-primary)}",
			".dshUsage_peak .dshUsage_tariffName{color:var(--dsw-alias-state-warn-primary)}",
			".dshUsage_valley .dshUsage_tariffName{color:var(--dsw-alias-state-success-primary)}",
			".dshUsage_summary{display:flex;flex-wrap:wrap;gap:10px}",
			".dshUsage_stat{box-sizing:border-box;display:flex;flex-direction:column;gap:2px;min-width:120px;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2)}",
			".dshUsage_statLabel{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}",
			".dshUsage_statValue{font-size:15px;line-height:22px;font-weight:500;font-variant-numeric:tabular-nums}",
			".dshUsage_note{font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary)}",
			".dshUsage_group{display:flex;flex-direction:column;gap:6px}",
			".dshUsage_groupHead{display:flex;align-items:baseline;justify-content:space-between;gap:10px;min-width:0;padding:2px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}",
			".dshUsage_groupTitle{font-size:13px;font-weight:500;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dshUsage_groupPath{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
			".dshUsage_groupTotals{flex:none;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}",
			".dshUsage_rows{display:flex;flex-direction:column}",
			".dshUsage_row{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:12px;padding:7px 8px;border-radius:var(--dsw-radius-sm)}",
			".dshUsage_row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshUsage_rowTitle{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:20px}",
			".dshUsage_rowTime{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}",
			".dshUsage_rowTokens{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}",
			".dshUsage_rowCost{font-size:13px;line-height:20px;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap;min-width:72px;text-align:right}",
			".dshUsage_unknown{color:var(--dsw-alias-label-tertiary)}",
			".dshUsage_running{display:inline-block;width:6px;height:6px;margin-right:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary);vertical-align:middle}",
			".dshUsage_state{display:flex;align-items:center;gap:8px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}",
			".dshUsage_error{color:var(--dsw-alias-state-error-primary)}"
		].join("");
		const tagId = "dsh-plugin-billing-assistant/BillingAssistant.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-plugin-billing-assistant";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion

		//#region official sources
		/** Official DeepSeek pages the billing-period row and the panel link to. */
		const OFFICIAL_SOURCES = {
			/** States the current peak/off-peak rule and the per-model prices. */
			pricing: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing",
			/** The 2026-08-13 announcement that introduced peak/off-peak pricing. */
			announcement: "https://api-docs.deepseek.com/zh-cn/news/news260813"
		};
		//#endregion

		//#region tariff model
		/**
		 * DeepSeek peak/off-peak ("峰谷定价") model, per the official docs:
		 * https://api-docs.deepseek.com/zh-cn/quick_start/pricing
		 *
		 *   "空闲时段价格为高峰时段价格的一半。北京时间周一至周五（不含中国法定节假日）
		 *    9:00 - 12:00、14:00 - 18:00 为高峰时段；其余时段，包括周末及中国法定
		 *    节假日全天均为空闲时段。"
		 *
		 * Peak (峰价)   = Beijing Mon–Fri, not a public holiday, 09:00–12:00 / 14:00–18:00
		 * Valley (谷价) = every other instant, incl. all weekends and holidays, at 50% price
		 *
		 * Introduced 2026-08-17 (changelog 2026-08-13); weekends all-valley since
		 * 2026-08-23; DeepSeek clarified on 2026-09-19 that weekends shifted to work
		 * days (调休) stay off-peak. The earlier 00:30–08:30 off-peak window is
		 * historical (2025-02-26 → 2025-09-05) and no longer applies.
		 */
		const MINUTE_MS = 60 * 1000;
		const DAY_MS = 24 * 60 * MINUTE_MS;
		/** China Standard Time has had no DST since 1991, so a fixed offset is exact. */
		const BEIJING_OFFSET_MS = 8 * 60 * MINUTE_MS;
		/** Peak windows as Beijing minutes-of-day, half-open `[start, end)`. */
		const PEAK_WINDOWS = [[9 * 60, 12 * 60], [14 * 60, 18 * 60]];
		/**
		 * Chinese public holidays, from 国务院办公厅关于2026年部分节假日安排的通知
		 * (国办发明电〔2025〕7号, 2025-11-04): inclusive Beijing date ranges.
		 * Weekends are off-peak regardless, so only weekday entries matter here.
		 * A later year's notice must be appended when it is published.
		 */
		const HOLIDAY_RANGES = [
			["2026-01-01", "2026-01-03"], // 元旦
			["2026-02-15", "2026-02-23"], // 春节
			["2026-04-04", "2026-04-06"], // 清明节
			["2026-05-01", "2026-05-05"], // 劳动节
			["2026-06-19", "2026-06-21"], // 端午节
			["2026-09-25", "2026-09-27"], // 中秋节
			["2026-10-01", "2026-10-07"] // 国庆节
		];
		/** How far ahead the next-switch search looks; the longest holiday run is under this. */
		const SWITCH_LOOKAHEAD_DAYS = 40;

		/** Positive modulo, so pre-epoch instants cannot produce a negative day offset. */
		function positiveModulo(value, modulus) {
			return ((value % modulus) + modulus) % modulus;
		}

		/** Beijing calendar fields for one instant (China has no DST, so this is exact). */
		function beijingParts(date) {
			const shifted = new Date(date.getTime() + BEIJING_OFFSET_MS);
			return {
				dateKey: String(shifted.getUTCFullYear()) + "-" + String(shifted.getUTCMonth() + 1).padStart(2, "0") + "-" + String(shifted.getUTCDate()).padStart(2, "0"),
				weekday: shifted.getUTCDay(),
				minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
			};
		}

		/** Epoch milliseconds of the Beijing midnight that starts `date`'s Beijing day. */
		function beijingDayStartMs(date) {
			return date.getTime() - positiveModulo(date.getTime() + BEIJING_OFFSET_MS, DAY_MS);
		}

		/** Whether one Beijing calendar day is a Chinese public holiday. */
		function isHolidayDate(dateKey) {
			for (const [start, end] of HOLIDAY_RANGES) if (dateKey >= start && dateKey <= end) return true;
			return false;
		}

		/** Whether one instant sits inside a peak window (weekday, non-holiday, in a window). */
		function isPeakInstant(date) {
			const parts = beijingParts(date);
			if (parts.weekday === 0 || parts.weekday === 6) return false;
			if (isHolidayDate(parts.dateKey)) return false;
			for (const [start, end] of PEAK_WINDOWS) if (parts.minutes >= start && parts.minutes < end) return true;
			return false;
		}

		/** @returns 'peak' (峰价) or 'valley' (谷价) for one instant. */
		function tariffAt(date) {
			return isPeakInstant(date) ? "peak" : "valley";
		}

		/**
		 * Milliseconds until the next peak/valley transition, found by walking the
		 * candidate boundaries (Beijing midnight and every peak-window edge) forward
		 * until the tariff state differs.
		 */
		function msUntilSwitch(date) {
			const current = tariffAt(date);
			const dayStart = beijingDayStartMs(date);
			for (let day = 0; day <= SWITCH_LOOKAHEAD_DAYS; day++) {
				for (const boundary of [0, PEAK_WINDOWS[0][0], PEAK_WINDOWS[0][1], PEAK_WINDOWS[1][0], PEAK_WINDOWS[1][1]]) {
					const candidateMs = dayStart + day * DAY_MS + boundary * MINUTE_MS;
					if (candidateMs <= date.getTime()) continue;
					if (tariffAt(new Date(candidateMs)) !== current) return candidateMs - date.getTime();
				}
			}
			return 0;
		}
		//#endregion

		//#region cost model
		/**
		 * Official DeepSeek list prices, CNY per 1M tokens, effective 2026-09-10
		 * (https://api-docs.deepseek.com/zh-cn/quick_start/pricing). Off-peak is
		 * exactly half of peak for every category, cache-hit input included.
		 *
		 * `deepseek-chat` / `deepseek-reasoner` were discontinued on 2026-07-24 and
		 * are intentionally absent. To price a session running another model,
		 * point PRICE_BASIS at that model's row.
		 */
		const PRICE_TABLE = {
			"deepseek-flash": {
				peak: { cacheRead: 0.04, cacheMiss: 2, output: 8 },
				offPeak: { cacheRead: 0.02, cacheMiss: 1, output: 4 }
			},
			"deepseek-v4-pro": {
				peak: { cacheRead: 0.3, cacheMiss: 9, output: 27 },
				offPeak: { cacheRead: 0.15, cacheMiss: 4.5, output: 13.5 }
			}
		};
		/** Model row the estimates use; the session token projection is route-blind. */
		const PRICE_BASIS = { model: "deepseek-flash", currency: "CNY", effective: "2026-09-10" };

		/** The zero bucket set of the `tokenUsage` projection. */
		function zeroUsage() {
			return { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
		}

		/** Read one bucket defensively; a missing or malformed value counts as zero. */
		function bucket(value) {
			const number = Number(value);
			return Number.isFinite(number) && number > 0 ? number : 0;
		}

		/** Normalize a raw `tokenUsage` projection value into the four buckets. */
		function normalizeUsage(raw) {
			return {
				uncachedInputTokens: bucket(raw.uncachedInputTokens),
				outputTokens: bucket(raw.outputTokens),
				cacheReadTokens: bucket(raw.cacheReadTokens),
				cacheWriteTokens: bucket(raw.cacheWriteTokens)
			};
		}

		/** Add one usage into an accumulator, mutating and returning it. */
		function addUsage(total, usage) {
			total.uncachedInputTokens += usage.uncachedInputTokens;
			total.outputTokens += usage.outputTokens;
			total.cacheReadTokens += usage.cacheReadTokens;
			total.cacheWriteTokens += usage.cacheWriteTokens;
			return total;
		}

		/** Every input token that is billed (cache reads and writes included). */
		function billedInputTokens(usage) {
			return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
		}

		/** Total tokens across all four buckets. */
		function totalTokensOf(usage) {
			return billedInputTokens(usage) + usage.outputTokens;
		}

		/**
		 * Estimated cost in the basis currency. Cache-miss rate applies to uncached
		 * input and to cache writes (DeepSeek publishes no separate write price);
		 * the cache-hit rate applies to cache reads.
		 */
		function costOf(usage, tariff) {
			const rates = PRICE_TABLE[PRICE_BASIS.model][tariff === "peak" ? "peak" : "offPeak"];
			const missRated = usage.uncachedInputTokens + usage.cacheWriteTokens;
			return (missRated * rates.cacheMiss + usage.cacheReadTokens * rates.cacheRead + usage.outputTokens * rates.output) / 1e6;
		}

		/** Cache-hit share of billed input, or undefined when nothing is billed. */
		function cacheHitRatio(usage) {
			const billed = billedInputTokens(usage);
			return billed === 0 ? undefined : usage.cacheReadTokens / billed;
		}
		//#endregion

		//#region formatting
		/** Currency symbol for a Platform wallet currency. */
		function currencySymbol(currency) {
			return currency === "USD" ? "$" : "¥";
		}

		/** Group the integer part with commas. */
		function groupDigits(integer) {
			return String(integer).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		}

		/**
		 * Format a decimal balance string the way the shipped account page does:
		 * zero, sub-cent (`<¥0.01`) and truncate-to-cents rules included.
		 */
		function formatAmount(amount, currency) {
			const symbol = currencySymbol(currency);
			const text = typeof amount === "string" ? amount.trim() : String(amount ?? "");
			const negative = text.startsWith("-");
			const digits = negative ? text.slice(1) : text;
			const dot = digits.indexOf(".");
			const integer = (dot === -1 ? digits : digits.slice(0, dot)) || "0";
			const fraction = dot === -1 ? "" : digits.slice(dot + 1);
			const cents = (fraction + "00").slice(0, 2);
			const meaningful = /[1-9]/.test(integer) || /[1-9]/.test(fraction);
			if (!meaningful) return symbol + "0.00";
			const subCent = !/[1-9]/.test(integer) && !/[1-9]/.test(cents);
			if (negative) return "-" + symbol + (subCent ? "0.01" : groupDigits(integer) + "." + cents);
			if (subCent) return "<" + symbol + "0.01";
			return symbol + groupDigits(integer) + "." + cents;
		}

		/** True when a wallet holds a non-zero decimal amount. */
		function isPositiveAmount(amount) {
			const text = typeof amount === "string" ? amount : String(amount ?? "");
			return /[1-9]/.test(text);
		}

		/** Compact token count for the narrow footer (`1.2M`, `12.3k`, `742`). */
		function formatTokens(value) {
			const number = Math.max(0, Math.round(Number(value) || 0));
			if (number >= 1e6) return (number / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
			if (number >= 1e3) return (number / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
			return String(number);
		}

		/** Exact grouped token count for the panel. */
		function formatExactTokens(value) {
			return groupDigits(String(Math.max(0, Math.round(Number(value) || 0))));
		}

		/** Estimated money, four decimals below one unit and two above it. */
		function formatCost(value) {
			const number = Number(value);
			if (!Number.isFinite(number) || number <= 0) return currencySymbol(PRICE_BASIS.currency) + "0.00";
			if (number < 0.0001) return "<" + currencySymbol(PRICE_BASIS.currency) + "0.0001";
			if (number < 1) return currencySymbol(PRICE_BASIS.currency) + number.toFixed(4);
			return currencySymbol(PRICE_BASIS.currency) + number.toFixed(2);
		}

		/**
		 * Grouping key for a directory: separators unified, trailing separator
		 * dropped, lower-cased (Windows paths are case-insensitive). Empty when the
		 * conversation carries no directory.
		 */
		function normalizePath(value) {
			if (typeof value !== "string") return "";
			const trimmed = value.replace(/[\\/]+$/, "").replace(/\\/g, "/");
			return trimmed === "" ? "" : trimmed.toLowerCase();
		}

		/** Last segment of a directory path, used as the title of an unregistered folder. */
		function pathLabel(value) {
			if (typeof value !== "string") return "";
			const trimmed = value.replace(/[\\/]+$/, "");
			const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
			const label = cut === -1 ? trimmed : trimmed.slice(cut + 1);
			return label === "" ? trimmed : label;
		}

		/** Short relative time (`3m`, `2h`, `5d`) for a timestamp in the past. */		function formatRelative(timestamp, now) {
			if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return "";
			const delta = Math.max(0, now - timestamp);
			const minutes = Math.floor(delta / MINUTE_MS);
			if (minutes < 1) return "<1m";
			if (minutes < 60) return String(minutes) + "m";
			const hours = Math.floor(minutes / 60);
			if (hours < 24) return String(hours) + "h";
			return String(Math.floor(hours / 24)) + "d";
		}

		/** Human duration text built from locale unit words (no interpolation API needed). */
		function durationText(t, ms) {
			const totalMinutes = Math.max(0, Math.floor(ms / MINUTE_MS));
			const hours = Math.floor(totalMinutes / 60);
			const minutes = totalMinutes % 60;
			if (hours > 0 && minutes > 0) return String(hours) + t("hourUnit") + String(minutes) + t("minUnit");
			if (hours > 0) return String(hours) + t("hourUnit");
			if (minutes > 0) return String(minutes) + t("minUnit");
			return t("lessThanMinute");
		}

		/**
		 * Unwrap one generated Remote result. Unary remotes answer with
		 * `RemoteResult<T>` (`{ok:true,value}` / `{ok:false,error}`); an already
		 * unwrapped value passes through unchanged.
		 */
		function unwrapRemote(result) {
			if (result !== null && typeof result === "object" && typeof result.ok === "boolean") return result.ok ? result.value : undefined;
			return result;
		}
		//#endregion

		//#region locales
		/** Dictionary namespace owned by this plugin. */
		const NS = "balanceTariff";
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			title: "余额、计费时段与用量",
			balance: "余额",
			tariff: "计费时段",
			peak: "峰价",
			valley: "谷价",
			bonus: "赠",
			loading: "读取中…",
			signedOut: "登录后查看",
			unavailable: "暂不可用",
			failed: "读取失败",
			zero: "—",
			tariffSource: "点击查看官方峰谷定价说明",
			panelOpen: "打开「用量与费用」面板",
			rule: "官方峰谷定价（2026-08-17 起）：北京时间周一至周五（不含中国法定节假日）09:00–12:00、14:00–18:00 为峰价；其余时段，含周末与法定节假日全天，均为谷价（峰价的一半）。",
			hourUnit: "小时",
			minUnit: "分",
			lessThanMinute: "不到 1 分钟",
			untilPeak: "后转峰价",
			untilValley: "后转谷价",
			usage: "累计消耗",
			usageUnknown: "统计中…",
			usageDetail: "输入 {input} · 输出 {output} · 缓存命中 {hit}",
			usageDetailPlain: "输入 {input} · 输出 {output}",
			panel: "用量与费用",
			panelTitle: "用量与费用",
			panelRefresh: "刷新",
			panelTotalTokens: "累计 Token",
			panelTotalCost: "估算费用",
			panelSessions: "会话数",
			panelBasis: "按 {model} 现价估算（{date} 起生效）",
			panelRateNote: "当前为{tariff}，费用按当前时段费率估算，实际扣费以账单为准。",
			panelLoading: "正在读取会话用量…",
			panelEmpty: "还没有可统计的会话。",
			panelUnavailable: "无法读取会话列表。",
			panelProgress: "已统计 {known}/{total} 个会话",
			panelUngrouped: "未知目录",
			panelWorkspaceTotals: "{tokens} · {cost}",
			panelRunning: "进行中",
			panelUnknown: "待统计",
			panelRetry: "重试"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			title: "Balance, rate window and usage",
			balance: "Balance",
			tariff: "Rate",
			peak: "Standard",
			valley: "Off-peak",
			bonus: "Bonus",
			loading: "Loading…",
			signedOut: "Sign in to view",
			unavailable: "Unavailable",
			failed: "Read failed",
			zero: "—",
			tariffSource: "Open the official peak/off-peak pricing page",
			panelOpen: "Open the usage and cost panel",
			rule: "Official peak/off-peak pricing (from 2026-08-17): Beijing time Mon–Fri, excluding Chinese public holidays, 09:00–12:00 and 14:00–18:00 are peak; every other instant, including all weekends and holidays, is off-peak at half the peak price.",
			hourUnit: "h ",
			minUnit: "m ",
			lessThanMinute: "<1 min ",
			untilPeak: "to standard",
			untilValley: "to off-peak",
			usage: "Total usage",
			usageUnknown: "Counting…",
			usageDetail: "{input} in · {output} out · {hit} cached",
			usageDetailPlain: "{input} in · {output} out",
			panel: "Usage and cost",
			panelTitle: "Usage and cost",
			panelRefresh: "Refresh",
			panelTotalTokens: "Total tokens",
			panelTotalCost: "Estimated cost",
			panelSessions: "Conversations",
			panelBasis: "Estimated at {model} list price (effective {date})",
			panelRateNote: "Currently {tariff}; costs use the current rate and the real bill may differ.",
			panelLoading: "Reading conversation usage…",
			panelEmpty: "No conversations to report yet.",
			panelUnavailable: "The conversation list is unavailable.",
			panelProgress: "Counted {known}/{total} conversations",
			panelUngrouped: "Unknown folder",
			panelWorkspaceTotals: "{tokens} · {cost}",
			panelRunning: "Running",
			panelUnknown: "Counting",
			panelRetry: "Retry"
		};
		//#endregion

		//#region usage store
		/** Cadence of the full usage re-read. */
		const USAGE_POLL_MS = 60 * 1000;
		/** Delay between two projection materializations, so hydration stays polite. */
		const HYDRATE_GAP_MS = 140;
		/** Most sessions materialized in one drain pass; the rest wait for the next cycle. */
		const HYDRATE_BATCH = 60;

		/** Promise-based delay used by the hydration queue. */
		function wait(ms) {
			return new Promise((resolve) => {
				window.setTimeout(resolve, ms);
			});
		}

		/** Read one session's token projection value out of the sessions catalog snapshot. */
		function usageFromSnapshot(sessionsState, sessionId) {
			const row = sessionsState.byId === undefined ? undefined : sessionsState.byId[sessionId];
			const direct = row === undefined || row.projectionValues === undefined ? undefined : row.projectionValues.tokenUsage;
			if (direct !== undefined) return normalizeUsage(direct);
			const projected = sessionsState.projectionsBySession === undefined ? undefined : sessionsState.projectionsBySession[sessionId];
			const value = projected === undefined || projected.values === undefined ? undefined : projected.values.tokenUsage;
			return value === undefined ? undefined : normalizeUsage(value);
		}

		/**
		 * Observable usage model behind both the footer block and the usage panel:
		 * workspaces with their conversations, each carrying tokens and estimated
		 * cost, plus the grand total.
		 *
		 * Sessions are read from the client catalog; a session whose `tokenUsage`
		 * projection has not been materialized yet is hydrated one at a time through
		 * `ctx.sessions.refreshProjections`, so opening the app never fans out into
		 * unbounded history I/O.
		 */
		function createUsageStore(ctx) {
			let snapshot = {
				phase: "loading",
				groups: [],
				totals: zeroUsage(),
				known: 0,
				total: 0,
				tariff: tariffAt(new Date()),
				updatedAt: Date.now()
			};
			const listeners = new Set();
			const attempted = new Set();
			let queued = [];
			let draining = false;
			let disposed = false;
			let timer = 0;
			let retryTimer = 0;

			/** Snapshot stores hand back an unsubscribe function. */
			function publish() {
				for (const listener of [...listeners]) {
					try {
						listener();
					} catch (_error) {
						/* a broken listener must not stop the others */
					}
				}
			}

			function sessionsState() {
				const sessions = ctx.get("sessions");
				if (sessions === undefined || sessions === null || sessions.list === undefined) return undefined;
				return sessions.list.getSnapshot();
			}

			function workspacesState() {
				const workspaces = ctx.get("workspaces");
				if (workspaces === undefined || workspaces === null || workspaces.list === undefined) return undefined;
				return workspaces.list.getSnapshot();
			}

			/** Build the groups, totals and progress figures for one catalog state. */
			function recompute() {
				const state = sessionsState();
				if (state === undefined) {
					snapshot = { ...snapshot, phase: "unavailable", updatedAt: Date.now() };
					publish();
					return;
				}
				const now = Date.now();
				const tariff = tariffAt(new Date(now));
				const totals = zeroUsage();
				let known = 0;
				const rows = new Map();
				const ids = Array.isArray(state.ids) ? state.ids : [];
				for (const id of ids) {
					const row = state.byId === undefined ? undefined : state.byId[id];
					if (row === undefined || row.blank === true) continue;
					const usage = usageFromSnapshot(state, id);
					if (usage !== undefined) {
						known++;
						addUsage(totals, usage);
					}
					rows.set(id, {
						id,
						title: typeof row.displayTitle === "string" && row.displayTitle !== "" ? row.displayTitle : id,
						cwd: row.cwd,
						running: row.running === true,
						updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : undefined,
						usage,
						cost: usage === undefined ? undefined : costOf(usage, tariff)
					});
				}
				// Group by the conversation's REAL directory, not by the DSH workspace
				// records: child/subagent conversations and conversations whose folder
				// was never registered as a workspace still belong to their own cwd.
				// A registered workspace only supplies the nicer title for its folder.
				const workspaceState = workspacesState();
				const items = workspaceState !== undefined && Array.isArray(workspaceState.items) ? workspaceState.items : [];
				const workspaceByPath = new Map();
				const workspaceRank = new Map();
				for (let index = 0; index < items.length; index++) {
					const key = normalizePath(items[index].path);
					if (key === "") continue;
					if (!workspaceByPath.has(key)) {
						workspaceByPath.set(key, items[index]);
						workspaceRank.set(key, index);
					}
				}
				const byDirectory = new Map();
				for (const entry of rows.values()) {
					const key = normalizePath(entry.cwd);
					let group = byDirectory.get(key);
					if (group === undefined) {
						const workspace = key === "" ? undefined : workspaceByPath.get(key);
						group = {
							id: key,
							title: workspace === undefined ? (key === "" ? undefined : pathLabel(entry.cwd)) : workspace.title,
							path: key === "" ? undefined : entry.cwd,
							members: [],
							registeredRank: workplaceRankOf(workspaceRank, key),
							latest: 0
						};
						byDirectory.set(key, group);
					}
					group.members.push(entry);
					group.latest = Math.max(group.latest, entry.updatedAt ?? 0);
				}
				const ordered = [...byDirectory.values()].sort((left, right) => (left.registeredRank - right.registeredRank) || (right.latest - left.latest));
				const groups = ordered.map((group) => groupOf(group.id, group.title, group.path, group.members, tariff));
				snapshot = {
					phase: state.phase === "ready" ? "ready" : "loading",
					groups,
					totals,
					known,
					total: rows.size,
					tariff,
					updatedAt: now
				};
				publish();
			}

			/**
			 * Sort rank for one directory: registered workspaces keep their registry
			 * order, other directories follow by recency, and conversations without a
			 * directory come last.
			 */
			function workplaceRankOf(workspaceRank, key) {
				if (key === "") return 100000;
				const rank = workspaceRank.get(key);
				return rank === undefined ? 10000 : rank;
			}

			/** One directory group with its own totals. */
			function groupOf(directoryKey, title, path, members, tariff) {
				const totals = zeroUsage();
				let known = 0;
				for (const member of members) if (member.usage !== undefined) { known++; addUsage(totals, member.usage); }
				return {
					id: directoryKey,
					title,
					path,
					sessions: members.slice().sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0)),
					totals,
					known,
					cost: costOf(totals, tariff)
				};
			}

			/** Queue every session whose projection value is still unknown. */
			function enqueueUnknown() {
				const state = sessionsState();
				if (state === undefined) return;
				const ids = Array.isArray(state.ids) ? state.ids : [];
				for (const id of ids) {
					const row = state.byId === undefined ? undefined : state.byId[id];
					if (row === undefined || row.blank === true) continue;
					if (attempted.has(id) || queued.includes(id)) continue;
					if (usageFromSnapshot(state, id) !== undefined) {
						attempted.add(id);
						continue;
					}
					queued.push(id);
				}
				void drain();
			}

			/** Materialize queued projections one at a time, then recompute. */
			async function drain() {
				if (draining || disposed) return;
				draining = true;
				let handled = 0;
				while (!disposed && queued.length > 0 && handled < HYDRATE_BATCH) {
					const id = queued.shift();
					if (attempted.has(id)) continue;
					attempted.add(id);
					handled++;
					const sessions = ctx.get("sessions");
					if (sessions === undefined || sessions === null || typeof sessions.refreshProjections !== "function") break;
					try {
						await sessions.refreshProjections(id);
					} catch (_error) {
						/* leave the row unknown; a later cycle retries it */
					}
					if (disposed) break;
					recompute();
					await wait(HYDRATE_GAP_MS);
				}
				draining = false;
			}

			/** Force a full re-read and re-queue every unresolved session. */
			function refresh() {
				attempted.clear();
				queued = [];
				recompute();
				enqueueUnknown();
			}

			/** Start polling and subscribe to the two catalogs. */
			function start() {
				recompute();
				enqueueUnknown();
				const sessions = ctx.get("sessions");
				const workspaces = ctx.get("workspaces");
				const disposers = [];
				if (sessions !== undefined && sessions !== null && sessions.list !== undefined && typeof sessions.list.subscribe === "function") {
					disposers.push(sessions.list.subscribe(() => {
						recompute();
						enqueueUnknown();
					}));
				}
				if (workspaces !== undefined && workspaces !== null && workspaces.list !== undefined && typeof workspaces.list.subscribe === "function") {
					disposers.push(workspaces.list.subscribe(recompute));
				}
				timer = window.setInterval(() => {
					recompute();
					enqueueUnknown();
				}, USAGE_POLL_MS);
				// Sessions that failed to materialize get another chance every five minutes.
				retryTimer = window.setInterval(() => {
					attempted.clear();
					enqueueUnknown();
				}, 5 * USAGE_POLL_MS);
				const onVisibility = () => {
					if (document.hidden !== true) {
						recompute();
						enqueueUnknown();
					}
				};
				document.addEventListener("visibilitychange", onVisibility);
				return () => {
					disposed = true;
					window.clearInterval(timer);
					window.clearInterval(retryTimer);
					document.removeEventListener("visibilitychange", onVisibility);
					for (const dispose of disposers) {
						try {
							dispose();
						} catch (_error) {
							/* already torn down */
						}
					}
					listeners.clear();
				};
			}

			return {
				getSnapshot: () => snapshot,
				subscribe(listener) {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
				refresh,
				start
			};
		}

		/** Subscribe a component to one snapshot store. */
		function useStoreValue(store) {
			const [value, setValue] = react.useState(() => store.getSnapshot());
			react.useEffect(() => {
				setValue(store.getSnapshot());
				return store.subscribe(() => setValue(store.getSnapshot()));
			}, [store]);
			return value;
		}
		//#endregion

		//#region footer block
		/** Balance re-read cadence while the panel holds a real answer. */
		const POLL_MS = 60 * 1000;
		/** Faster cadence while nothing usable has been read yet. */
		const RETRY_MS = 5 * 1000;
		/** Countdown re-render cadence. */
		const CLOCK_MS = 20 * 1000;

		/** Compact balance text for the current snapshot. */
		function balanceText(snapshot, t) {
			if (snapshot.phase === "ready") {
				const wallets = Array.isArray(snapshot.wallets) ? snapshot.wallets : [];
				if (wallets.length === 0) return t("zero");
				return wallets.map((wallet) => formatAmount(wallet.balance, wallet.currency)).join(" / ");
			}
			if (snapshot.phase === "signed-out") return t("signedOut");
			if (snapshot.phase === "loading") return t("loading");
			if (snapshot.phase === "unavailable") return t("unavailable");
			return t("failed");
		}

		/** Granted-balance text, or null when there is nothing granted to show. */
		function bonusText(snapshot, t) {
			if (snapshot.phase !== "ready") return null;
			const wallets = Array.isArray(snapshot.bonusWallets) ? snapshot.bonusWallets.filter((wallet) => isPositiveAmount(wallet.balance)) : [];
			if (wallets.length === 0) return null;
			return t("bonus") + " " + wallets.map((wallet) => formatAmount(wallet.balance, wallet.currency)).join(" / ");
		}

		/** Fill `{name}` placeholders so the dictionaries need no interpolation API. */
		function fill(text, values) {
			return String(text).replace(/\{(\w+)\}/g, (match, name) => (values[name] === undefined ? match : String(values[name])));
		}

		/**
		 * The sidebar-foot block: balance, current billing period, total token
		 * consumption and its estimated cost.
		 */
		function BalanceTariffFooter(props) {
			const t = props.t;
			const bridge = props.bridge;
			const store = props.usage;
			const wide = props.wide !== false;
			const [snapshot, setSnapshot] = react.useState({ phase: "loading" });
			const [now, setNow] = react.useState(() => Date.now());
			const bridgeRef = react.useRef(bridge);
			bridgeRef.current = bridge;
			const tickRef = react.useRef(null);
			const usage = useStoreValue(store);

			react.useEffect(() => {
				let disposed = false;
				let timer = 0;
				const tick = () => {
					if (disposed) return;
					window.clearTimeout(timer);
					const current = bridgeRef.current;
					if (current === undefined) {
						setSnapshot({ phase: "unavailable" });
						timer = window.setTimeout(tick, RETRY_MS);
						return;
					}
					Promise.resolve()
						.then(() => current.read())
						.then((next) => {
							if (disposed) return;
							setSnapshot(next);
							timer = window.setTimeout(tick, next.phase === "ready" || next.phase === "signed-out" ? POLL_MS : RETRY_MS);
						}, () => {
							if (disposed) return;
							setSnapshot({ phase: "failed" });
							timer = window.setTimeout(tick, RETRY_MS);
						});
				};
				tickRef.current = tick;
				tick();
				const onVisibility = () => {
					if (document.hidden !== true) tick();
				};
				document.addEventListener("visibilitychange", onVisibility);
				return () => {
					disposed = true;
					tickRef.current = null;
					window.clearTimeout(timer);
					document.removeEventListener("visibilitychange", onVisibility);
				};
			}, []);

			react.useEffect(() => {
				const timer = window.setInterval(() => {
					setNow(Date.now());
				}, CLOCK_MS);
				return () => {
					window.clearInterval(timer);
				};
			}, []);

			const tariff = tariffAt(new Date(now));
			const tariffName = tariff === "valley" ? t("valley") : t("peak");
			// The label names the period that is coming, not the one in effect.
			const countdown = durationText(t, msUntilSwitch(new Date(now))) + (tariff === "valley" ? t("untilPeak") : t("untilValley"));
			const tariffClass = tariff === "valley" ? "dshBt_valley" : "dshBt_peak";
			const balance = balanceText(snapshot, t);
			const bonus = bonusText(snapshot, t);
			const totalUsage = totalTokensOf(usage.totals);
			const usageValue = usage.known === 0 ? t("usageUnknown") : formatTokens(totalUsage) + " ≈ " + formatCost(usage.totals === undefined ? 0 : sumCost(usage));
			const summary = t("balance") + " " + balance + " · " + tariffName + " · " + countdown;

			if (!wide) {
				const badge = jsx("button", {
					type: "button",
					className: "dshBt_badge " + (tariff === "valley" ? "dshBt_badgeValley" : "dshBt_badgePeak"),
					"aria-label": summary,
					title: summary,
					onClick: props.openPanel,
					children: jsx("span", { className: "dshBt_badgeDot", "aria-hidden": "true" })
				});
				if (Tooltip === undefined) return badge;
				return jsx(Tooltip, {
					label: summary,
					delayMs: 400,
					children: badge
				});
			}

			const detail = usage.known === 0
				? t("usageUnknown")
				: fill(t("usageDetail"), {
					input: formatTokens(usage.totals.uncachedInputTokens + usage.totals.cacheReadTokens + usage.totals.cacheWriteTokens),
					output: formatTokens(usage.totals.outputTokens),
					hit: cacheHitRatio(usage.totals) === undefined ? t("zero") : Math.round(cacheHitRatio(usage.totals) * 100) + "%"
				});

			return jsxs("div", {
				className: "dshBt_card",
				children: [
					jsxs("span", {
						className: "dshBt_row",
						children: [
							jsx("span", { className: "dshBt_label", children: t("balance") }),
							jsx("span", {
								className: "dshBt_value",
								children: bonus === null ? balance : [jsx("span", { children: balance }, "balance"), jsx("span", { className: "dshBt_bonus", children: bonus }, "bonus")]
							})
						]
					}, "balance"),
					// The billing period row is the official-source link: activating it opens
					// DeepSeek's pricing page in the app's external-link path.
					jsxs("a", {
						className: "dshBt_row dshBt_rowLink " + tariffClass,
						href: OFFICIAL_SOURCES.pricing,
						target: "_blank",
						rel: "noopener noreferrer",
						title: t("tariffSource") + " · " + OFFICIAL_SOURCES.pricing,
						"aria-label": t("tariff") + " " + tariffName + "，" + t("tariffSource"),
						onClick: (event) => openOfficialSource(event, t),
						children: [
							jsx("span", { className: "dshBt_label", children: t("tariff") }),
							jsxs("span", {
								className: "dshBt_tariff",
								children: [
									jsx("span", { className: "dshBt_dot", "aria-hidden": "true" }),
									jsx("span", { className: "dshBt_name", children: tariffName }),
									jsx("span", { className: "dshBt_note", children: countdown }),
									jsx("span", { className: "dshBt_source", "aria-hidden": "true", children: "↗" })
								]
							})
						]
					}, "tariff"),
					// The usage row is the panel entry (the panel itself lives in main).
					jsxs("button", {
						type: "button",
						className: "dshBt_row dshBt_rowButton",
						onClick: props.openPanel,
						title: t("panelOpen"),
						children: [
							jsxs("span", {
								className: "dshBt_label dshBt_labelButton",
								children: [t("usage"), jsx("span", { className: "dshBt_chevron", "aria-hidden": "true", children: "›" })]
							}),
							jsx("span", { className: "dshBt_value", children: usageValue })
						]
					}, "usage"),
					jsx("span", { className: "dshBt_detail", children: detail }, "detail")
				]
			});
		}

		/**
		 * Open an official source outside the app, mirroring the shipped external-link
		 * behaviour (target=_blank plus `window.open(..., "noopener,noreferrer")`);
		 * modified clicks keep their native meaning.
		 */
		function openOfficialSource(event, t) {
			if (event !== undefined && event !== null && (event.button !== 0 || event.metaKey === true || event.ctrlKey === true || event.shiftKey === true || event.altKey === true)) return;
			if (event !== undefined && event !== null && typeof event.preventDefault === "function") event.preventDefault();
			try {
				window.open(OFFICIAL_SOURCES.pricing, "_blank", "noopener,noreferrer");
			} catch (_error) {
				/* the anchor's own target=_blank remains the fallback */
			}
		}

		/** Total estimated cost of a store snapshot (summed per group, tariff-aware). */
		function sumCost(usage) {
			return costOf(usage.totals, usage.tariff);
		}
		//#endregion

		//#region usage panel
		/** One summary tile. */
		function Stat(props) {
			return jsxs("div", {
				className: "dshUsage_stat",
				children: [jsx("span", { className: "dshUsage_statLabel", children: props.label }), jsx("span", { className: "dshUsage_statValue", children: props.value })]
			});
		}

		/** One conversation row. */
		function UsageRow(props) {
			const entry = props.entry;
			const t = props.t;
			const now = props.now;
			const known = entry.usage !== undefined;
			const tokens = known
				? formatExactTokens(entry.usage.uncachedInputTokens + entry.usage.cacheReadTokens + entry.usage.cacheWriteTokens) + " / " + formatExactTokens(entry.usage.outputTokens)
				: t("panelUnknown");
			return jsxs("div", {
				className: "dshUsage_row",
				children: [
					jsx("span", {
						className: "dshUsage_rowTitle",
						title: entry.title,
						children: entry.running ? [jsx("span", { className: "dshUsage_running", "aria-hidden": "true" }, "dot"), entry.title] : entry.title
					}),
					jsx("span", { className: "dshUsage_rowTime", children: formatRelative(entry.updatedAt, now) }),
					jsx("span", { className: "dshUsage_rowTokens" + (known ? "" : " dshUsage_unknown"), children: tokens }),
					jsx("span", { className: "dshUsage_rowCost" + (known ? "" : " dshUsage_unknown"), children: known ? formatCost(entry.cost) : t("zero") })
				]
			});
		}

		/** One workspace group. */
		function UsageGroup(props) {
			const group = props.group;
			const t = props.t;
			const now = props.now;
			return jsxs("section", {
				className: "dshUsage_group",
				children: [
					jsxs("header", {
						className: "dshUsage_groupHead",
						children: [
							jsxs("span", {
								style: { minWidth: 0, display: "flex", flexDirection: "column" },
								children: [
									jsx("span", { className: "dshUsage_groupTitle", children: group.title === undefined || group.title === "" ? t("panelUngrouped") : group.title }),
									group.path === undefined ? null : jsx("span", { className: "dshUsage_groupPath", title: group.path, children: group.path })
								]
							}),
							jsx("span", {
								className: "dshUsage_groupTotals",
								children: fill(t("panelWorkspaceTotals"), {
									tokens: formatExactTokens(totalTokensOf(group.totals)),
									cost: formatCost(group.cost)
								})
							})
						]
					}),
					jsx("div", { className: "dshUsage_rows", children: group.sessions.map((entry) => jsx(UsageRow, { entry, t, now }, entry.id)) })
				]
			}, group.id === "" ? "__ungrouped" : group.id);
		}

		/** The `usage-cost` main panel: every workspace and conversation with tokens and cost. */
		function UsagePanel(props) {
			const t = props.t;
			const store = props.usage;
			const usage = useStoreValue(store);
			const [now, setNow] = react.useState(() => Date.now());

			react.useEffect(() => {
				const timer = window.setInterval(() => setNow(Date.now()), CLOCK_MS);
				return () => window.clearInterval(timer);
			}, []);

			const tariff = usage.tariff;
			const tariffName = tariff === "valley" ? t("valley") : t("peak");
			const header = jsxs("header", {
				className: "dshUsage_header",
				children: [
					jsx("h1", { className: "dshUsage_title", children: t("panelTitle") }),
					jsxs("div", {
						className: "dshUsage_headerEnd",
						children: [
							jsxs("span", {
								className: "dshUsage_tariff " + (tariff === "valley" ? "dshUsage_valley" : "dshUsage_peak"),
								children: [
									jsx("span", { className: "dshUsage_tariffDot", "aria-hidden": "true" }),
									jsx("span", { className: "dshUsage_tariffName", children: tariffName })
								]
							}),
							Button === undefined
								? null
								: jsx(Button, { variant: "outline", size: "sm", onClick: () => store.refresh(), children: t("panelRefresh") })
						]
					})
				]
			});

			const summary = jsxs("div", {
				className: "dshUsage_summary",
				children: [
					jsx(Stat, { label: t("panelTotalTokens"), value: usage.known === 0 ? t("zero") : formatExactTokens(totalTokensOf(usage.totals)) }, "tokens"),
					jsx(Stat, { label: t("panelTotalCost"), value: usage.known === 0 ? t("zero") : formatCost(sumCost(usage)) }, "cost"),
					jsx(Stat, { label: t("panelSessions"), value: String(usage.total) }, "sessions")
				]
			});

			const notes = jsxs("div", {
				className: "dshUsage_note",
				children: [
					jsx("div", { children: fill(t("panelBasis"), { model: PRICE_BASIS.model, date: PRICE_BASIS.effective }) }),
					jsx("div", { children: fill(t("panelRateNote"), { tariff: tariffName }) }),
					jsx("div", { children: fill(t("panelProgress"), { known: String(usage.known), total: String(usage.total) }) })
				]
			});

			let body;
			if (usage.phase === "unavailable") {
				body = jsxs("div", {
					className: "dshUsage_state dshUsage_error",
					role: "alert",
					children: [StateDot === undefined ? null : jsx(StateDot, { state: "error" }), jsx("span", { children: t("panelUnavailable") })]
				});
			} else if (usage.groups.length === 0) {
				body = jsxs("div", {
					className: "dshUsage_state",
					role: "status",
					children: [StateDot === undefined ? null : jsx(StateDot, { state: "ongoing" }), jsx("span", { children: usage.phase === "ready" ? t("panelEmpty") : t("panelLoading") })]
				});
			} else {
				body = jsx("div", { className: "dshUsage_group", children: usage.groups.map((group) => jsx(UsageGroup, { group, t, now }, group.id === "" ? "__ungrouped" : group.id)) });
			}

			return jsxs("div", { className: "dshUsage_root", children: [header, summary, notes, body] });
		}
		//#endregion

		//#region plugin
		/** Panel id shared by the sidebar menu entry and the main panel it opens. */
		const PANEL_ID = "usage-cost";
		/** Client version reported to the Platform with account calls (metadata only). */
		const CLIENT_VERSION = typeof globalThis.__DSH_CLIENT_VERSION__ === "string" && globalThis.__DSH_CLIENT_VERSION__ !== "" ? globalThis.__DSH_CLIENT_VERSION__ : "0.2.0-rc.2";
		/**
		 * Services required by the plugin. Only the slot and locale faces are
		 * mandatory: the account and session catalogs are resolved at call time, so
		 * the billing-period half (and the panel's shell) still render without them.
		 */
		const inject = ["slots", "locale"];

		/**
		 * Read the current account snapshot through the generated account remote.
		 * Remote namespaces are separate Cordis services ("remote.account"), not
		 * properties of the gateway service.
		 */
		function createBridge(ctx) {
			return {
				async read() {
					const remote = ctx.get("remote");
					const account = ctx.get("remote.account") ?? (remote === undefined || remote === null ? undefined : remote.account);
					if (account === undefined || account === null) return { phase: "unavailable" };
					let state;
					try {
						state = await account.getState();
					} catch (_error) {
						return { phase: "failed" };
					}
					const view = unwrapRemote(state);
					if (view === undefined) return { phase: "failed" };
					if (view === null) return { phase: "unavailable" };
					if (view.status !== "credential-stored") return { phase: "signed-out" };
					const client = {
						version: CLIENT_VERSION,
						locale: String(ctx.locale.getSnapshot().active ?? "zh"),
						timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60
					};
					let balance;
					try {
						balance = await account.getBalance(client);
					} catch (_error) {
						return { phase: "failed" };
					}
					const value = unwrapRemote(balance);
					if (value === undefined) return { phase: "failed" };
					if (value === null) return { phase: "signed-out" };
					if (value.status !== "ready") return { phase: "failed" };
					return {
						phase: "ready",
						wallets: Array.isArray(value.value) ? value.value : [],
						bonusWallets: Array.isArray(value.bonusWallets) ? value.bonusWallets : []
					};
				}
			};
		}

		/**
		 * Register the footer block (which carries both the billing-period
		 * official-source link and the usage-panel entry) and the usage panel.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "balance-tariff: dictionaries");
			const t = ctx.locale.bind(NS);
			const bridge = createBridge(ctx);
			const usage = createUsageStore(ctx);
			ctx.effect(() => usage.start(), "balance-tariff: usage store");
			// Resolved at click time so the block still renders if the layout face is
			// absent; the panel entry sits in the footer, not in the sidebar menu.
			const openPanel = () => {
				const layout = ctx.get("layout");
				if (layout !== undefined && layout !== null && typeof layout.selectPanel === "function") layout.selectPanel(PANEL_ID);
			};

			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "billing-assistant",
				order: 20,
				label: () => t("title"),
				locale: NS,
				inject: () => ({
					t,
					bridge,
					usage,
					openPanel
				})
			}, BalanceTariffFooter));

			ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: PANEL_ID,
				locale: NS,
				inject: () => ({
					t,
					usage
				})
			}, UsagePanel));
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		/** Pure-logic seam for headless verification (`_probe/verify-client.js`); not used by the GUI. */
		exports.__test = {
			tariffAt,
			isPeakInstant,
			isHolidayDate,
			beijingParts,
			msUntilSwitch,
			formatAmount,
			durationText,
			normalizeUsage,
			addUsage,
			totalTokensOf,
			billedInputTokens,
			cacheHitRatio,
			costOf,
			createUsageStore,
			normalizePath,
			pathLabel,
			formatTokens,
			formatExactTokens,
			formatCost,
			formatRelative,
			fill,
			openOfficialSource,
			OFFICIAL_SOURCES,
			PRICE_TABLE,
			PRICE_BASIS
		};
		return module.exports;
	}
});
