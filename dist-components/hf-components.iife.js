var HFComponents = (function(exports, react, react_dom_client) {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	//#region \0rolldown/runtime.js
	var __create = Object.create;
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __getProtoOf = Object.getPrototypeOf;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
			key = keys[i];
			if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: ((k) => from[k]).bind(null, key),
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
		value: mod,
		enumerable: true
	}) : target, mod));
	//#endregion
	react = __toESM(react);
	react_dom_client = __toESM(react_dom_client);
	//#region src/components/nexus-ui/attachments.tsx
	var AttachmentListContext = (0, react.createContext)({ variant: "compact" });
	var FileIcon = () => /* @__PURE__ */ react.default.createElement("svg", {
		width: "13",
		height: "13",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round"
	}, /* @__PURE__ */ react.default.createElement("path", { d: "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" }), /* @__PURE__ */ react.default.createElement("polyline", { points: "13 2 13 9 20 9" }));
	var VideoIcon = () => /* @__PURE__ */ react.default.createElement("svg", {
		width: "13",
		height: "13",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round"
	}, /* @__PURE__ */ react.default.createElement("rect", {
		x: "2",
		y: "5",
		width: "14",
		height: "14",
		rx: "2"
	}), /* @__PURE__ */ react.default.createElement("path", { d: "m22 8-6 4 6 4V8z" }));
	var AudioIcon = () => /* @__PURE__ */ react.default.createElement("svg", {
		width: "13",
		height: "13",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round"
	}, /* @__PURE__ */ react.default.createElement("path", { d: "M9 18V5l12-2v13" }), /* @__PURE__ */ react.default.createElement("circle", {
		cx: "6",
		cy: "18",
		r: "3"
	}), /* @__PURE__ */ react.default.createElement("circle", {
		cx: "18",
		cy: "16",
		r: "3"
	}));
	var RemoveIcon = () => /* @__PURE__ */ react.default.createElement("svg", {
		width: "10",
		height: "10",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2.8",
		strokeLinecap: "round"
	}, /* @__PURE__ */ react.default.createElement("line", {
		x1: "18",
		y1: "6",
		x2: "6",
		y2: "18"
	}), /* @__PURE__ */ react.default.createElement("line", {
		x1: "6",
		y1: "6",
		x2: "18",
		y2: "18"
	}));
	function Thumb({ attachment }) {
		if (attachment.type === "image" && attachment.url) return /* @__PURE__ */ react.default.createElement("img", {
			src: attachment.url,
			alt: attachment.name,
			loading: "lazy",
			decoding: "async",
			style: {
				width: "28px",
				height: "28px",
				borderRadius: "5px",
				objectFit: "cover",
				flexShrink: 0,
				display: "block"
			}
		});
		const iconMap = {
			image: /* @__PURE__ */ react.default.createElement(FileIcon, null),
			video: /* @__PURE__ */ react.default.createElement(VideoIcon, null),
			audio: /* @__PURE__ */ react.default.createElement(AudioIcon, null),
			file: /* @__PURE__ */ react.default.createElement(FileIcon, null)
		};
		return /* @__PURE__ */ react.default.createElement("span", { style: {
			width: "28px",
			height: "28px",
			borderRadius: "5px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			flexShrink: 0,
			background: "rgba(255,255,255,0.05)",
			color: "currentColor"
		} }, iconMap[attachment.type]);
	}
	function Attachment({ attachment, variant: variantProp, onRemove }) {
		const ctx = (0, react.useContext)(AttachmentListContext);
		variantProp ?? ctx.variant;
		return /* @__PURE__ */ react.default.createElement("span", {
			style: {
				display: "inline-flex",
				alignItems: "center",
				gap: "7px",
				maxWidth: "100%",
				padding: "4px 8px 4px 4px",
				borderRadius: "999px",
				border: "1px solid rgba(255,255,255,0.10)",
				background: "rgba(255,255,255,0.05)",
				color: "rgba(255,255,255,0.75)",
				fontSize: "12px",
				fontFamily: "inherit",
				whiteSpace: "nowrap",
				backdropFilter: "blur(6px)",
				WebkitBackdropFilter: "blur(6px)",
				transition: "border-color 0.15s ease, background 0.15s ease"
			},
			"data-hf-attachment-chip": "true"
		}, /* @__PURE__ */ react.default.createElement(Thumb, { attachment }), /* @__PURE__ */ react.default.createElement("span", { style: {
			maxWidth: "160px",
			overflow: "hidden",
			textOverflow: "ellipsis",
			flexShrink: 1,
			lineHeight: 1.3,
			letterSpacing: "-0.01em",
			fontWeight: 500
		} }, attachment.name), /* @__PURE__ */ react.default.createElement("span", { style: {
			padding: "1px 5px",
			borderRadius: "4px",
			background: "rgba(255,255,255,0.06)",
			fontSize: "9px",
			fontWeight: 700,
			letterSpacing: "0.05em",
			textTransform: "uppercase",
			color: "rgba(255,255,255,0.4)",
			flexShrink: 0
		} }, attachment.type), onRemove && /* @__PURE__ */ react.default.createElement("button", {
			type: "button",
			onClick: (e) => {
				e.stopPropagation();
				onRemove();
			},
			title: "Retirer",
			style: {
				width: "18px",
				height: "18px",
				borderRadius: "999px",
				border: "none",
				background: "transparent",
				color: "rgba(255,255,255,0.35)",
				cursor: "pointer",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 0,
				flexShrink: 0,
				transition: "color 0.15s ease, background 0.15s ease"
			},
			onMouseEnter: (e) => {
				e.currentTarget.style.color = "rgba(255,255,255,0.9)";
				e.currentTarget.style.background = "rgba(255,255,255,0.08)";
			},
			onMouseLeave: (e) => {
				e.currentTarget.style.color = "rgba(255,255,255,0.35)";
				e.currentTarget.style.background = "transparent";
			}
		}, /* @__PURE__ */ react.default.createElement(RemoveIcon, null)));
	}
	function AttachmentList({ variant = "compact", children, style, ...rest }) {
		return /* @__PURE__ */ react.default.createElement(AttachmentListContext.Provider, { value: { variant } }, /* @__PURE__ */ react.default.createElement("div", {
			style: {
				display: "flex",
				gap: "7px",
				flexWrap: "wrap",
				alignItems: "center",
				marginTop: "10px",
				...style
			},
			...rest
		}, children));
	}
	//#endregion
	//#region src/components-entry.tsx
	/**
	* HFComponents entry point
	*
	* This IIFE bundle is loaded AFTER React/ReactDOM are already on window
	* (mounted by support.js). It exposes a global `window.HFComponents` object
	* that the dc-runtime can call to mount React components into the existing UI.
	*
	* Usage in the dc-runtime template (via React.createElement):
	*   React.createElement(window.HFComponents.AttachmentList, {...})
	*
	* Or imperatively for a plain DOM slot:
	*   window.HFComponents.mountAttachments(domEl, attachments, onRemove)
	*/
	/**
	* Imperatively mount / update the attachment list into a DOM element.
	* Called by the dc-runtime's `localView()` whenever `attachments` changes.
	*/
	function mountAttachments(container, attachments) {
		const root = container.__hfRoot;
		const render = () => /* @__PURE__ */ react.default.createElement(AttachmentList, null, attachments.map((a) => /* @__PURE__ */ react.default.createElement(Attachment, {
			key: `${a.name}-${a.type}`,
			variant: "compact",
			attachment: a,
			onRemove: a.onRemove
		})));
		if (!root) {
			container.__hfRoot = react_dom_client.default.createRoot(container);
			container.__hfRoot.render(render());
		} else root.render(render());
	}
	window.HFComponents = {
		Attachment,
		AttachmentList,
		mountAttachments
	};
	//#endregion
	exports.Attachment = Attachment;
	exports.AttachmentList = AttachmentList;
	exports.mountAttachments = mountAttachments;
	return exports;
})({}, React, ReactDOM);

//# sourceMappingURL=hf-components.iife.js.map