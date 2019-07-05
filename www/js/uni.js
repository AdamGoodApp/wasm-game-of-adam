function generateStars() {
  for (var i = 0; i < 100; i++) {
    $("<span></span>", {
      class: "star"
    })
      .css({
        left: Math.random() * ($(window).innerWidth() - 20),
        top: Math.random() * ($(window).innerHeight() - 20)
      })
      .appendTo(document.body);
  }
}
var count = 0;
var myInterval = setInterval(function() {
  if (count > 5) {
    clearInterval(myInterval);
  }
  generateStars();
  count++;
}, 5000);
generateStars();
