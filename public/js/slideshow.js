<<<<<<< HEAD
let slides = document.querySelectorAll(".slideshow img");
let index = 0;

function showSlide() {
  slides.forEach((slide, i) => {
    slide.classList.remove("active");
    if (i === index) slide.classList.add("active");
  });
  index = (index + 1) % slides.length;
}

setInterval(showSlide, 4000);
showSlide();
=======
let slides = document.querySelectorAll(".slideshow img");
let index = 0;

function showSlide() {
  slides.forEach((slide, i) => {
    slide.classList.remove("active");
    if (i === index) slide.classList.add("active");
  });
  index = (index + 1) % slides.length;
}

setInterval(showSlide, 4000);
showSlide();
>>>>>>> c7c55a2978a931ab5459e6400daa26e995a55093
