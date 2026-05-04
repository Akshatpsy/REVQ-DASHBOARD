const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

const db = new sqlite3.Database(
    path.resolve(__dirname, '../../revq.db')
);

// ------------------------------
// GET PRODUCT DETAILS
// ------------------------------

app.get('/api/product/:id', (req, res) => {
    const productId = req.params.id;

    // 1. Get base product
    db.get(
        `SELECT * FROM products WHERE id = ?`,
        [productId],
        (err, product) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'DB error' });
            }

            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            // 2. Get platform-level aggregated data
            db.all(
                `
                SELECT 
                    pp.id as platform_product_id,
                    pp.platform,
                    pp.image_url,
                    pp.pack_size,
                    pp.weight,
                    pp.weight_unit,
                    
                    p.price,
                    p.mrp,
                    p.discount_percent,
                    p.scraped_at,

                    COUNT(a.pincode) as total_pincodes,
                    SUM(CASE WHEN a.in_stock = 1 THEN 1 ELSE 0 END) as in_stock_count

                FROM platform_products pp

                JOIN prices p 
                    ON p.platform_product_id = pp.id

                JOIN availability a 
                    ON a.platform_product_id = pp.id

                WHERE pp.product_id = ?
                
                GROUP BY pp.id
                `,
                [productId],
                (err, rows) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'DB error' });
                    }

                    // 3. Format response cleanly
                    const platforms = rows.map(r => ({
                        platform: r.platform,
                        image: r.image_url,
                        pack_size: r.pack_size,
                        weight: r.weight,
                        weight_unit: r.weight_unit,
                        price: r.price,
                        mrp: r.mrp,
                        discount: Number(r.discount_percent?.toFixed(2)),
                        availability: {
                            available: r.in_stock_count,
                            total: r.total_pincodes
                        },
                        last_scraped: r.scraped_at
                    }));

                    res.json({
                        id: product.id,
                        name: product.name,
                        brand: product.brand,
                        platforms
                    });
                }
            );
        }
    );
});

// ------------------------------

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});