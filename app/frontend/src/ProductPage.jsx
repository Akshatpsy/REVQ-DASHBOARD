import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const ProductPage = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);

        const response = await fetch(`http://localhost:3000/api/product/${id}`);
        if (!response.ok) {
          throw new Error('Product not found');
        }

        const data = await response.json();
        setProduct(data);
        setError(null);
      } catch (err) {
        setError(err.message);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  // ---------- STATES ----------

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading product data...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="error-state">
        <h2 style={{ color: 'var(--error-color)' }}>Oops!</h2>
        <p>{error || "Something went wrong"}</p>
        <button onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }

  // ---------- DATA ----------

  const image = product.platforms.find(p => p.image)?.image;

  return (
    <div className="product-container">
      <div className="glass-card">

        {/* HEADER */}
        <div className="product-header">
          <img
            src={image || "/fallback.png"}
            alt={product.name}
            className="product-image"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/fallback.png";
            }}
          />

          <div className="product-info">
            <span className="brand-badge">{product.brand}</span>
            <h1>{product.name}</h1>
          </div>
        </div>

        {/* TABLE */}
        <div className="platforms-table-wrapper">
          <table className="platforms-table">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Price</th>
                <th>Availability</th>
                <th>Last Scraped</th>
              </tr>
            </thead>

            <tbody>
              {product.platforms.map((p) => {

                const available = p.availability.available;
                const total = p.availability.total;

                // dot logic
                let dotClass = 'dot-red';
                if (available === total && total > 0) dotClass = 'dot-green';
                else if (available > 0) dotClass = 'dot-yellow';

                const dateStr = new Date(p.last_scraped).toLocaleString();

                return (
                  <tr key={p.platform}>
                    <td>
                      <div className="platform-name">
                        {p.platform}
                      </div>
                      {(p.pack_size > 1 || p.weight) && (
                        <div className="platform-meta" style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '4px' }}>
                          {p.pack_size > 1 && <span>Pack of {p.pack_size}</span>}
                          {p.pack_size > 1 && p.weight && <span> • </span>}
                          {p.weight && <span>{p.weight}{p.weight_unit}</span>}
                        </div>
                      )}
                    </td>

                    <td>
                      <div>
                        <span className="price-main">₹{p.price}</span>
                        {p.mrp > p.price && (
                          <span className="price-mrp">₹{p.mrp}</span>
                        )}
                      </div>

                      {p.discount > 0 && (
                        <div className="discount-badge">
                          {p.discount.toFixed(0)}% OFF
                        </div>
                      )}
                    </td>

                    <td>
                      <div className="availability">
                        <span className={`availability-dot ${dotClass}`}></span>
                        Live in {available} of {total} pincodes
                      </div>
                    </td>

                    <td>
                      <div className="timestamp">{dateStr}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

          </table>
        </div>

      </div>
    </div>
  );
};

export default ProductPage;