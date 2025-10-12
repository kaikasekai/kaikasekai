import React, { useState, useRef } from "react";
import "./index.css"; // стили возьмутся из твоего общего файла index.css

const ProofCarousel = ({ proofs }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const nextSlide = () => {
    setCurrentSlide((prev) =>
      prev === proofs.length - 1 ? 0 : prev + 1
    );
  };

  const prevSlide = () => {
    setCurrentSlide((prev) =>
      prev === 0 ? proofs.length - 1 : prev - 1
    );
  };

  const goToSlide = (index) => setCurrentSlide(index);

  // swipe support
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      diff > 0 ? nextSlide() : prevSlide();
    }
  };

  return (
    <div className="carousel">
      <div
        className="carousel-inner"
        style={{
          transform: `translateX(-${currentSlide * 100}%)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {proofs.map((proof, index) => (
          <div className="carousel-slide" key={index}>
            <div className="nft-section">{proof.nft}</div>
            <div className="result-section">{proof.result}</div>
          </div>
        ))}
      </div>

      <button className="carousel-arrow left" onClick={prevSlide}>
        ‹
      </button>
      <button className="carousel-arrow right" onClick={nextSlide}>
        ›
      </button>

      <div className="carousel-dots">
        {proofs.map((_, index) => (
          <span
            key={index}
            className={`dot ${index === currentSlide ? "active" : ""}`}
            onClick={() => goToSlide(index)}
          />
        ))}
      </div>
    </div>
  );
};

export default ProofCarousel;
