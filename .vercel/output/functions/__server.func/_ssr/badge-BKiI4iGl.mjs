import { R as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as cn } from "./router-CWvcnj1Z.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/badge-BKiI4iGl.js
var import_jsx_runtime = require_jsx_runtime();
function Badge({ className, tone = "muted", children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums", {
			muted: "text-muted border-border",
			ok: "text-ok border-ok/30",
			live: "text-live border-live/30",
			danger: "text-danger border-danger/30"
		}[tone], className),
		children
	});
}
//#endregion
export { Badge as t };
