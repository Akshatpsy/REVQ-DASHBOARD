# RevQ Dashboard - Intern Exercise

This project is my submission for the RevQ Dashboard exercise. It consists of a robust data ingestion pipeline built in Node.js, a lightweight Express API, and a React (Vite) frontend for displaying cross-platform product comparisons.

## How to Run

1. **Database & Ingestion (Optional, pre-populated)**
   ```bash
   node ingest/ingest.js
   ```

2. **Start the Backend API**
   ```bash
   cd app/backend
   npm install
   node server.js
   ```

3. **Start the React Frontend**
   ```bash
   cd app/frontend
   npm install
   npm run dev
   ```
   Navigate to `http://localhost:5173/product/2` to view the dashboard!

---

## 1. Product Matching Logic

To aggregate prices across Zepto, Blinkit, and Instamart, I implemented an in-memory string normalization pipeline during ingestion:
- **Fast Filtering**: I extract the first word of the raw name (e.g., "Yogabar") to use as a SQL `LIKE` filter, preventing O(N) full table scans.
- **Normalization**: The string is passed through `toLowerCase()` and all special characters are stripped (`[^a-z0-9 ]/g`).
- **Unit Stripping**: Weights like `50g` and `1kg` are explicitly removed via regex (`\d+g|\d+gm|\d+kg`) to ensure "Energy Bar 50g" matches "Energy Bar".
- **Matching**: If the normalized strings perfectly match or are subsets (`.includes()`), the `platform_product_id` is linked to the existing canonical `product_id`.

## 2. Component Structure

The React frontend focuses strictly on clean prop boundaries and separation of concerns.

- `App`: The root component handling React Router. It exposes a single route `/product/:id`.
- `ProductPage`: The orchestrator component that handles data fetching, loading animations, and error handling. It structures the layout and maps the API response to presentation elements.
- `ProductHeader`: (Inline within ProductPage) Renders the canonical name, brand, and an image fallback `onError` handler.
- `PlatformTable`: Iterates over the platforms array to generate the comparison view.
- `PlatformRow`: Renders the specific platform data, calculating the availability indicator logic (Green = 100% stock, Yellow = Partial, Red = Out of stock).

## 3. State Management

All state lives entirely within the `ProductPage` component, utilizing standard React Hooks (`useState`, `useEffect`).
- **Where data lives**: The core state is `const [product, setProduct]`.
- **Why**: Since this is a single-route application (`/product/:id`), there is no need for complex global state managers (Redux/Zustand) or Context API. The data is fundamentally tied to the URL parameter (`id`), so the data lifecycle perfectly matches the component lifecycle.
- **Loading & Error States**: Explicit `loading` and `error` states are managed here. I deliberately built a skeleton/spinner for `loading` and a retry boundary for `error` to handle missing products and API failures gracefully.

## 4. What's Broken (Honest Assessment)

My string-matching algorithm is pragmatic for this sample data, but it is fundamentally fragile:
- **Pack Sizes**: It currently drops unit weights but does not handle multipacks cleanly. If Zepto lists "Pack of 6", it will either fail to match or (worse) match a single bar to a 6-pack, creating a massive false price discrepancy in the UI.
- **Flavor Variations**: If one platform drops a flavor name (e.g., "Multigrain Bar" vs "Multigrain Bar Cranberry"), the `includes()` subset logic might incorrectly merge distinct SKUs.
- **No Deduplication Engine**: The logic assumes the database is the source of truth sequentially. It cannot retroactively split a wrongly merged product if a better match arrives later.

At an enterprise scale, I would abandon Regex matching and implement a pipeline relying on **UPC/EAN barcodes**, **NLP Embeddings** for semantic similarity, and a **Human-in-the-loop (HITL)** queue for borderline confidence scores.

## 5. Next 4 Hours

If given 4 more hours, I would prioritize:

1. **Robust Product Matching**
   - Introduce fuzzy matching (Levenshtein / embeddings)
   - Separate pack size as structured metadata instead of string parsing

2. **Time-Series UI**
   - Add price history graph (last 30 days)
   - Enable platform-specific filtering

3. **Data Quality Layer**
   - Confidence score for matches
   - Flag ambiguous matches for manual review

4. **Performance Improvements**
   - Add indexes on `platform_products.product_id`
   - Cache API responses for frequent queries