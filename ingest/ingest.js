const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const db = new sqlite3.Database(path.resolve(__dirname, '../revq.db'));

// ---------- HELPERS ----------

function normalizeName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') // Remove all spaces and special chars to match "Yoga Bar" with "Yogabar"
        .replace(/\d+(\.\d+)?(g|gm|kg)/g, ''); // weights
}

function extractPackSize(name) {
    const match = name.match(/pack of (\d+)|(\d+)\s*x/i);
    return match ? parseInt(match[1] || match[2]) : 1;
}

function extractWeight(name) {
    const match = name.match(/(\d+(\.\d+)?)\s?(g|kg)/i);
    if (!match) return { weight: null, unit: null };

    let value = parseFloat(match[1]);
    let unit = match[3].toLowerCase();

    if (unit === 'kg') {
        value *= 1000;
        unit = 'g';
    }

    return { weight: value, unit };
}

function extractBrand(name) {
    return name.split(' ')[0] || 'Unknown';
}

// ---------- CORE INGEST ----------

async function ingestFile(filePath, platformType) {
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return;
    }

    const data = JSON.parse(fs.readFileSync(filePath));

    let products = [];
    let scrapedAt = new Date().toISOString();
    let platform = platformType;

    // ---------- NORMALIZE PER PLATFORM ----------

    if (platformType === 'blinkit') {
        products = data.products.map(p => ({
            id: p.blinkit_id,
            name: p.name,
            mrp: p.mrp,
            price: p.selling_price,
            image: p.image_url,
            availability: p.availability.map(a => ({
                pincode: a.pincode,
                in_stock: a.in_stock
            }))
        }));
        scrapedAt = data.scraped_at;
    }

    else if (platformType === 'instamart') {
        products = data.results.map(p => ({
            id: p.product_id,
            name: p.display_name,
            mrp: p.store_mrp,
            price: p.store_selling_price,
            image: p.image,
            availability: p.store_availability.map(a => ({
                pincode: a.pin,
                in_stock: a.available_qty > 0
            }))
        }));
        scrapedAt = new Date(parseInt(data.snapshot_time) * 1000).toISOString();
    }

    else if (platformType === 'zepto') {
        products = data.items.map(p => ({
            id: p.sku_code,
            name: p.title,
            mrp: p.price.mrp,
            price: p.price.final,
            image: p.image,
            availability: Object.entries(p.stock_by_pincode).map(([pin, val]) => ({
                pincode: pin,
                in_stock: val === 'available'
            }))
        }));
        scrapedAt = new Date(data.fetched_on).toISOString();
    }

    // ---------- PROCESS ----------

    const util = require('util');
    const dbGet = util.promisify(db.get).bind(db);
    const dbRun = function(sql, params) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    };

    for (const item of products) {
        const rawName = item.name;
        const normalized = normalizeName(rawName);
        const packSize = extractPackSize(rawName);
        const { weight, unit } = extractWeight(rawName);
        const brand = extractBrand(rawName);

        console.log(`[${platform}] Processing: ${rawName}`);

        try {
            const row = await dbGet(`
                SELECT p.id, p.name 
                FROM products p
                JOIN platform_products pp ON p.id = pp.product_id
                WHERE p.normalized_name = ? 
                  AND pp.pack_size = ? 
                  AND (pp.weight = ? OR (pp.weight IS NULL AND ? IS NULL))
                LIMIT 1
            `, [normalized, packSize, weight, weight]);

            const insertPlatform = async (productId) => {
                try {
                    const res = await dbRun(
                        `INSERT INTO platform_products (product_id, platform, platform_product_id, raw_name, image_url, pack_size, weight, weight_unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [productId, platform, item.id, rawName, item.image, packSize, weight, unit]
                    );
                    const ppId = res.lastID;

                    const discount = item.mrp > 0 ? ((item.mrp - item.price) / item.mrp) * 100 : 0;
                    await dbRun(
                        `INSERT INTO prices (platform_product_id, price, mrp, discount_percent, scraped_at) VALUES (?, ?, ?, ?, ?)`,
                        [ppId, item.price, item.mrp, discount, scrapedAt]
                    );

                    for (const a of item.availability) {
                        await dbRun(
                            `INSERT INTO availability (platform_product_id, pincode, in_stock, scraped_at) VALUES (?, ?, ?, ?)`,
                            [ppId, a.pincode, a.in_stock ? 1 : 0, scrapedAt]
                        );
                    }
                    console.log(`Inserted: ${rawName} (${platform})`);
                } catch (err) {
                    if (!err.message.includes('UNIQUE')) console.error(err);
                }
            };

            if (row) {
                await insertPlatform(row.id);
            } else {
                const res = await dbRun(
                    `INSERT INTO products (name, brand, normalized_name) VALUES (?, ?, ?)`,
                    [rawName, brand, normalized]
                );
                await insertPlatform(res.lastID);
            }
        } catch (err) {
            console.error(err);
        }
    }

    console.log(`Finished ingestion for ${platform}`);
}

// ---------- RUN ----------

async function run() {
    await ingestFile(path.resolve(__dirname, '../data/blinkit_sample.json'), 'blinkit');
    await ingestFile(path.resolve(__dirname, '../data/instamart_sample.json'), 'instamart');
    await ingestFile(path.resolve(__dirname, '../data/zepto_sample.json'), 'zepto');
    db.close(() => console.log("Database closed"));
}
run();