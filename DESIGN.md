# Apple-Grade visionOS Design System & Dashboard Guidelines
**Forge & Fabric Industries, Inc. — Garment MES & CMT Production Platform**

---

## 1. Executive Philosophy & Aesthetic North Star

This document is the **single source of truth** for all visual, interaction, and architectural styling decisions across the entire platform (Landing Page &rarr; Auth &rarr; Admin Dashboard &rarr; Module Views &rarr; Customer Self-Service Portal).

### 🚫 The "Anti-AI" Manifesto (Strictly Prohibited):
- **NO Generic AI Gradients**: No bright purple-to-cyan, teal-to-green, or rainbow candy gradients.
- **NO Emojis as UI Elements**: Never use system emojis (`🔥`, `🚀`, `✅`, `📦`) in dashboard titles, buttons, or badges. Use clean, geometric Lucide SVG icons.
- **NO Green Pill Clutter**: Avoid arbitrary green badges like "Live Sync", "AI Active", or decorative green checkmark lists that clutter data views.
- **NO Harsh Borders or Stark Solid Boxes**: Avoid raw `border-2 border-blue-500` or stark `#000` / `#FFF` unblended solid boxes.
- **NO Paragraph Boilerplate in Dashboards**: Keep text short, punchy, and meaningful. Prioritize high-density visual telemetry over paragraphs of explanation.

### ✨ The Apple visionOS Standard:
- **Layered Frosted Glassmorphism**: Translucent panels (`backdrop-blur-2xl bg-white/80 dark:bg-[#0E131F]/85`) with hairline border highlights (`border border-white/80 dark:border-white/[0.08]`) and soft micro-shadows.
- **Precision Typography**: Clean, high-contrast typography with clear hierarchy (Large bold numeric KPIs, uppercase micro-trackers, readable tabular numbers).
- **Industrial Precision**: All UI elements look and feel like precision factory floor telemetry tools, calibrated for industrial CMT manufacturing.

---

## 2. Master Color System & Design Tokens

### Primary Accent & Feedback Tokens
| Token Name | Hex Code | Purpose & Usage |
| :--- | :--- | :--- |
| **Apple Sapphire Blue** | `#0071E3` | Primary action buttons, active tabs, primary telemetry curves, links |
| **Sapphire Hover** | `#0077ED` | Button hover and interactive focus states |
| **Sapphire Subtle Glow** | `rgba(0, 113, 227, 0.10)` | Active icon backgrounds, badge backdrops, subtle gradients |
| **Apple Emerald (Success)**| `#10B981` / `#059669` | First-pass yield, completed stages, nominal telemetry status |
| **Apple Amber (Warning)** | `#F59E0B` / `#D97706` | Approaching delivery dates, partial returns, pending approvals |
| **Apple Crimson (Danger)** | `#EF4444` / `#DC2626` | Quality hold gates, blocked stage transitions, defect alerts |

### Neutral Background & Frosted Glass Surfaces
| Layer | Light Mode | Dark Mode (visionOS) | Classes / Tokens |
| :--- | :--- | :--- | :--- |
| **App Canvas / Mesh** | `#F8F9FA` | `#090A0F` | `bg-[#F8F9FA] dark:bg-[#090A0F]` |
| **Frosted Glass Tile** | `rgba(255, 255, 255, 0.80)` | `rgba(14, 19, 31, 0.85)` | `.glass-surface backdrop-blur-2xl` |
| **Hairline Borders** | `rgba(255, 255, 255, 0.80)` | `rgba(255, 255, 255, 0.08)` | `border border-white/80 dark:border-white/[0.08]` |
| **Inner Card Inset** | `rgba(0, 0, 0, 0.02)` | `rgba(255, 255, 255, 0.03)` | `bg-black/[0.02] dark:bg-white/[0.03]` |
| **Primary Text** | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | `text-foreground` |
| **Secondary / Muted Text**| `#64748B` (Slate 500) | `#94A3B8` (Slate 400) | `text-muted-foreground` |

---

## 3. Navigation & AppShell Integrity Rules

### Rule 1: Never Break Navigation Continuity
- **All authenticated portals** (Admin, Production Manager, Merchandiser, QC Inspector, Customer Intake) **MUST remain wrapped in `<AppShell>`**.
- Navigating into `/apply`, `/apply/new`, `/tablet`, or sub-views must **never** make the sidebar or top navigation disappear.
- Only unauthenticated guest users visiting external public URLs render the standalone public header/footer.

### Rule 2: Segmented Controls & Micro-Pills
- Sub-navigation within a page (e.g. `Production Pipeline Map` | `WIP Velocity Graph` | `Kanban Line`) uses Apple-grade segmented controls:
```tsx
<div className="inline-flex items-center p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-md">
  <button className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#1E2433] text-foreground shadow-xs">
    Active View
  </button>
</div>
```

---

## 4. Visual Telemetry & Charting Standards

### Recharts Palette Guidelines:
- **Always use explicit, calibrated hex codes** in SVG fills, strokes, and gradients. Avoid unresolvable CSS variables (`var(--navy)` / `var(--gold)`).
- **Area Load Curves**:
  - Stroke: `#0071E3` (width: `2.5px`)
  - Linear Gradient Fill: `#0071E3` with `stopOpacity={0.4}` at 5% down to `stopOpacity={0.0}` at 95%.
- **Donut Circle Charts (Gauges)**:
  - `innerRadius={45}` and `outerRadius={65}` with `paddingAngle={3}`.
  - Centered flow percentage metric with uppercase tracking label.
- **Bar Charts**:
  - `radius={[6, 6, 0, 0]}` for clean rounded top caps.
  - Custom frosted glass tooltips with `bg-white/95 dark:bg-[#121622]/95 backdrop-blur-xl`.

---

## 5. Concise Industrial Stage Taxonomy

To prevent text truncation (`Sewing P...` or `Laser / Oz...`) on dense 5-column grids, use these calibrated industrial names:

| Stage # | Full MES Name | Concise UI Label | Zone Assignment |
| :---: | :--- | :--- | :--- |
| **01** | Customer Order & PO Booking | `Order Intake` | Zone A (Materials) |
| **02** | Raw Material Receiving | `Raw Materials` | Zone A (Materials) |
| **03** | Fabric & Trim QC Inspection | `Fabric QC` | Zone A (Materials) |
| **04** | Pre-Production & Spreading | `Pre-Prod Plan` | Zone B (Cutting) |
| **05** | Pattern Grading & CNC Cutting | `Pattern & Cut` | Zone B (Cutting) |
| **06** | Bundling & Workstation Kitting | `Bundle Feeding` | Zone B (Cutting) |
| **07** | Modular Line Sewing Assembly | `Sewing Line` | Zone C (Sewing) |
| **08** | Pre-Wash QC Gate | `Pre-Wash QC` | Zone D (Laundry) |
| **09** | Laundry & Wet Processing | `Laundry Wash` | Zone D (Laundry) |
| **10** | Laser Whisker & Dry Finishing | `Laser & Finish` | Zone D (Laundry) |
| **11** | Final Quality Inspection | `Final AQL` | Zone E (Logistics) |
| **12** | Steam Pressing & Tagging | `Press & Tag` | Zone E (Logistics) |
| **13** | Finished Goods Packing & Dispatch | `Pack & Ship` | Zone E (Logistics) |

---

## 6. Component Hierarchy & Pattern Standards

### 1. KPI Metric Tile
```tsx
<div className="glass-surface rounded-2xl p-5 border border-white/80 dark:border-white/[0.08] shadow-xs">
  <div className="flex items-center justify-between">
    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Metric Label</span>
    <div className="h-8 w-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
      <Icon className="h-4 w-4" />
    </div>
  </div>
  <div className="mt-3 text-3xl font-bold tracking-tight text-foreground">1,250</div>
  <div className="mt-2 text-[11px] text-muted-foreground font-medium">Supporting telemetry info</div>
</div>
```

### 2. Primary Action Buttons
```tsx
<button className="h-10 px-4 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98">
  <span>Confirm Action</span>
  <ArrowRight className="w-3.5 h-3.5" />
</button>
```

### 3. Frosted Secondary Buttons
```tsx
<button className="h-10 px-4 rounded-xl bg-white/90 dark:bg-[#1A2030] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.1] text-foreground font-semibold text-xs shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer">
  <span>Cancel / Filter</span>
</button>
```

---

## 7. Development Checklist Before Any Commit

Before pushing any changes or introducing new pages:
1. [ ] **Navigation Check**: Is the page wrapped in `<AppShell>` for logged-in users? Does the sidebar remain accessible?
2. [ ] **Glassmorphic Parity**: Are card surfaces using `.glass-surface` with high-contrast foreground text?
3. [ ] **No AI Artifacts**: Are all system emojis removed? Are all repetitive paragraphs replaced with concise telemetry?
4. [ ] **Dark Mode Verified**: Do text colors use `text-foreground` and `text-muted-foreground` instead of hardcoded dark neutrals?
5. [ ] **Compilation Validation**: Run `npx tsc --noEmit` &rarr; 0 errors.
6. [ ] **Build Validation**: Run `npm run build` &rarr; Exits with code 0.
