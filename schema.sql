-- Canonical products (your "truth")
CREATE TABLE products 
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    normalized_name TEXT, -- for faster matching
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Mapping to each platform
CREATE TABLE platform_products 
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    platform_product_id TEXT NOT NULL,
    raw_name TEXT,
    image_url TEXT,

    -- useful for fixing pack-size mismatch
    pack_size INTEGER DEFAULT 1,
    weight REAL,
    weight_unit TEXT,

    UNIQUE(platform, platform_product_id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Time-series pricing
CREATE TABLE prices 
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform_product_id INTEGER NOT NULL,
    price REAL NOT NULL,
    mrp REAL,
    discount_percent REAL,
    scraped_at DATETIME NOT NULL,

    FOREIGN KEY (platform_product_id) REFERENCES platform_products(id)
);

-- Time-series availability (pincode-level)
CREATE TABLE availability 
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform_product_id INTEGER NOT NULL,
    pincode TEXT NOT NULL,
    in_stock BOOLEAN NOT NULL,
    scraped_at DATETIME NOT NULL,

    FOREIGN KEY (platform_product_id) REFERENCES platform_products(id)
);

-- 🔥 Indexes (this is where you score points)

-- Fast product matching
CREATE INDEX idx_products_normalized_name 
ON products(normalized_name);

-- Price queries (latest + history)
CREATE INDEX idx_prices_product_time 
ON prices(platform_product_id, scraped_at DESC);

-- Availability queries per pincode
CREATE INDEX idx_availability_product_pincode 
ON availability(platform_product_id, pincode);

-- Platform lookup optimization
CREATE INDEX idx_platform_products_lookup
ON platform_products(platform, product_id);