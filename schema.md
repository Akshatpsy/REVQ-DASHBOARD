# Database Schema Design & Scale Decisions

## 1. Cross-Platform Identity
**Question:** How do you model a "product" that exists across 3 platforms with 3 different IDs and 3 different name strings?

**Solution:** I modeled this using a normalized, hub-and-spoke approach. 
- The **`products`** table acts as the canonical "Hub", containing the agnostic truth of a product (`id`, `name`, `brand`).
- The **`platform_products`** table acts as the "Spokes", mapping the internal `product_id` to the external platform mappings (`platform`, `platform_product_id`, `image_url`).

This allows us to query all prices for a single canonical product while retaining the strict 1:1 data integrity of the scrape source.

## 2. Denormalization for Scale
**Question:** One denormalization or one index you'd add for scale, and why.

**Solution:** I would add a `normalized_name` column to the `products` table and index it.
- **Why:** Currently, when ingesting a new product, we must find if it already exists across platforms to assign it the correct `product_id`. Performing string normalization dynamically or using `LIKE` operations on raw names across millions of rows is an $O(N)$ full table scan nightmare.
- **Impact:** By denormalizing the regex-stripped name into a dedicated `normalized_name` column and placing a B-Tree or Hash Index on it, we reduce the cross-platform identity check from an expensive linear scan to an $O(1)$ lookup, vastly speeding up ingestion throughput.

## 3. Scaling to 100x Volume
**Question:** What you'd change if scrape volume went 100x.

**Solution:**
1. **Ditch SQLite:** SQLite is file-based and locks the entire database on writes. At 100x volume, the ingestion script would face massive lock contention. I would migrate to PostgreSQL to handle concurrent writes and leverage JSONB for unstructured scrape metadata.
2. **Decouple Ingestion:** I would move away from synchronous `fs.readFile()` ingestion. Instead, scrapers would push raw JSON payloads into an event queue (e.g., Kafka or RabbitMQ).
3. **Dedicated Matching Workers:** The logic determining if "Instamart Product A" is the same as "Blinkit Product B" is computationally heavy (especially if NLP/embeddings are used). I would decouple this into background workers consuming from the queue, allowing the matching algorithm to scale horizontally independently of the core API server.
