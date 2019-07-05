// ----------------------------------------------------------------------------
// Background

// rAF polyfill based on https://gist.github.com/1579671 ----------------------

(function() {
  var w = window;

  // Find vendor prefix, if any
  var vendors = ["ms", "moz", "webkit", "o"];
  for (var i = 0; i < vendors.length && !w.requestAnimationFrame; i++) {
    w.requestAnimationFrame = w[vendors[i] + "RequestAnimationFrame"];
  }

  // Use requestAnimationFrame if available
  if (w.requestAnimationFrame) {
    var next = 1,
      anims = {};

    w.setAnimation = function(callback, element) {
      var current = next++;
      anims[current] = true;

      var animate = function() {
        if (!anims[current]) {
          return;
        } // deleted?
        w.requestAnimationFrame(animate, element);
        callback();
      };
      w.requestAnimationFrame(animate, element);
      return current;
    };

    w.clearAnimation = function(id) {
      delete anims[id];
    };
  }

  // [set/clear]Interval fallback
  else {
    w.setAnimation = function(callback, element) {
      return w.setInterval(callback, 1000 / 60);
    };
    w.clearAnimation = w.clearInterval;
  }

  // Perlin Noise function for tumbling and dust movement -----------------------

  var PerlinNoise = function(size) {
    this.gx = [];
    this.gy = [];
    this.p = [];
    this.size = size || 256;
    size: 256;

    this.size = size || 256;

    for (var i = 0; i < this.size; i++) {
      this.gx.push(Math.random() * 2 - 1);
      this.gy.push(Math.random() * 2 - 1);
    }

    for (var j = 0; j < this.size; j++) {
      this.p.push(j);
    }
    this.p.sort(function() {
      return 0.5 - Math.random();
    });

    this.noise2 = function(x, y) {
      // Compute what gradients to use
      var qx0 = x | 0;
      var qx1 = qx0 + 1;
      var tx0 = x - qx0;
      var tx1 = tx0 - 1;

      var qy0 = y | 0;
      var qy1 = qy0 + 1;
      var ty0 = y - qy0;
      var ty1 = ty0 - 1;

      // Make sure we don't come outside the lookup table
      qx0 = qx0 % this.size;
      qx1 = qx1 % this.size;

      qy0 = qy0 % this.size;
      qy1 = qy1 % this.size;

      // Permutate values to get pseudo randomly chosen gradients
      var q00 = this.p[(qy0 + this.p[qx0]) % this.size];
      var q01 = this.p[(qy0 + this.p[qx1]) % this.size];

      var q10 = this.p[(qy1 + this.p[qx0]) % this.size];
      var q11 = this.p[(qy1 + this.p[qx1]) % this.size];

      // Compute the dotproduct between the vectors and the gradients
      var v00 = this.gx[q00] * tx0 + this.gy[q00] * ty0;
      var v01 = this.gx[q01] * tx1 + this.gy[q01] * ty0;

      var v10 = this.gx[q10] * tx0 + this.gy[q10] * ty1;
      var v11 = this.gx[q11] * tx1 + this.gy[q11] * ty1;

      // Modulate with the weight function
      var wx = (3 - 2 * tx0) * tx0 * tx0;
      var v0 = v00 - wx * (v00 - v01);
      var v1 = v10 - wx * (v10 - v11);

      var wy = (3 - 2 * ty0) * ty0 * ty0;
      var v = v0 - wy * (v0 - v1);

      return v;
    };
  };

  // Image preloader ------------------------------------------------------------

  var preload = function(images, callback) {
    var remaining = 0;
    var loaded = {};

    var onloadCallback = function(ev) {
      remaining--;
      if (!remaining) {
        callback(loaded);
      }
    };

    for (var i in images) {
      remaining++;
      var img = new Image();
      img.onload = onloadCallback;
      img.src = images[i];
      loaded[i] = img;
    }

    return loaded;
  };

  // Set up ---------------------------------------------------------------------

  // Get Canvas, create Noise function, register 'resize' and 'mousemove'
  // handlers and preload images

  var canvas = document.getElementById("bg");
  var ctx = null;
  var mouse = { x: 0, y: 0, cx: 0, cy: 0 };
  var blackOverlay = 1;
  var currentIndexTrans = 0;
  var startTime = 0;

  var i = 1563;
  var noise = new PerlinNoise();

  var backgroundAnimation = 0;

  var canvasResize = function() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
  };

  document.addEventListener(
    "mousemove",
    function(ev) {
      mouse.x = ev.clientX;
      mouse.y = ev.clientY;
    },
    false
  );

  var images = [];
  var loadBackground = function() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx = canvas.getContext("2d");
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    images = preload(
      {
        background:
          "https://s3-us-west-2.amazonaws.com/s.cdpn.io/216617/89275-space-stars-artwork.jpg",
        vignette: "https://i.stack.imgur.com/SdTGE.png",
        dustNear: "https://i.ytimg.com/vi/KsHUrwV0Kek/maxresdefault.jpg",
        dustFar: "https://i.ytimg.com/vi/KsHUrwV0Kek/maxresdefault.jpg"
      },
      function() {
        startTime = Date.now();
        backgroundAnimation = setAnimation(draw, canvas);
        window.addEventListener("resize", canvasResize, false);
      }
    );
  };

  // Draw -----------------------------------------------------------------------

  var fillImage = function(ctx, img, x, y) {
    // This seems to be faster than fillRect with a pattern
    var cw = ctx.canvas.width,
      ch = ctx.canvas.height,
      iw = img.width,
      ih = img.height;

    x = ((x % iw) - iw) % iw;
    y = ((y % ih) - ih) % ih;
    for (var nx = x; nx < cw; nx += iw) {
      for (var ny = y; ny < ch; ny += ih) {
        ctx.drawImage(img, nx, ny);
      }
    }
  };

  var frameCount = 0;
  var testForSlowBrowsers = true;
  var draw = function() {
    // Test slow systems
    frameCount++;
    var seconds = (Date.now() - startTime) / 1000;
    if (seconds > 1 && testForSlowBrowsers) {
      // Fewer than 20 frames in the last second? Disable background :/
      if (frameCount < 20) {
        clearAnimation(backgroundAnimation);
        blackOverlay = 0;
      }
      testForSlowBrowsers = false;
    }

    i += 0.78;
    var tumble = 32;

    var cw = canvas.width + tumble * 4;
    var ch = canvas.height + tumble * 2;

    // Aspect zoom
    var width = cw;
    var height = Math.ceil(
      images.background.height / (images.background.width / cw)
    );
    if (height < canvas.height) {
      width = Math.ceil(
        images.background.width / (images.background.height / ch)
      );
      height = ch;
    }

    // Mouse damping
    mouse.cx = mouse.x * 0.05 + mouse.cx * 0.95;
    mouse.cy = mouse.y * 0.05 + mouse.cy * 0.95;

    var mx = -(mouse.cx / canvas.width) * tumble;
    var my = -(mouse.cy / canvas.height) * tumble;
    var x =
      (canvas.width - width) / 2 + noise.noise2(i / 193, i / 233) * tumble + mx;
    var y = 0 + +noise.noise2(i / 241, i / 211) * tumble + my + tumble;

    var scale = images.background.width / width;

    // Moon
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(images.background, x, y, width, height);

    // Dust Layers
    var dx = x + i / 5,
      dy = y + i / 15 - 400 / 8; // extra vert scroll for dust layers

    ctx.globalAlpha = 0.4;
    ctx.globalCompositeOperation = "lighter";
    fillImage(ctx, images.dustFar, dx * 2, dy * 2);
    ctx.globalAlpha = 0.3;
    fillImage(ctx, images.dustNear, dx * 5, dy * 5);
    ctx.globalAlpha = 0.1;
    fillImage(ctx, images.dustNear, dx * 25, dy * 25);

    // Vignette
    ctx.globalAlpha = 0.7;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(images.vignette, 0, 0, canvas.width, canvas.height);

    // Scanlines
    // 	ctx.globalAlpha = 0.3;
    // 	fillImage( ctx, images.scanlines, 0, 0 );

    // 	// Fade from black overlay after loading
    // 	if( blackOverlay > 0 ) {
    // 		ctx.globalAlpha = blackOverlay;
    // 		ctx.fillStyle = '#111';
    // 		ctx.fillRect(0, 0, canvas.width, canvas.height );
    // 		blackOverlay -= 0.01;
    // 	}
  };

  // ----------------------------------------------------------------------------
  // Init

  loadBackground();
})();
