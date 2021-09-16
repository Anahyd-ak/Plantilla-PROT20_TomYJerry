/*
p5.play
por Paolo Pedercini/molleindustria, 2015
http://molleindustria.org/
*/

(function(root, factory) {
if (typeof define === 'function' && define.amd)
define('p5.play', ['@code-dot-org/p5'], function(p5) { (factory(p5)); });
else if (typeof exports === 'object')
factory(require('@code-dot-org/p5'));
else
factory(root.p5);
}(this, function(p5) {
/**
 * p5.play es una biblioteca para p5.js para facilitar la creación de juegos y proyectos
 * similares.
 *
 * Proporciona una clase Sprite flexible para administrar objetos visuales en el espacio 2D
 * y características como soporte de animación, detección básica de colisiones
 * y resolución, interacciones con el ratón y el teclado, y una cámara virtual.
 *
 * p5.play no es un motor físico derivado de box2D, no usa eventos y es
 * diseñado para ser entendido y posiblemente modificado por programadores intermedios.
 *
 * Consulta la carpeta de ejemplos para obtener más información sobre cómo utilizar esta biblioteca.
 *
 * @module p5.play
 * @submodule p5.play
 * @for p5.play
 * @main
 */

// =============================================================================
//                         Inicialización
// =============================================================================

var DEFAULT_FRAME_RATE = 30;

// Esta es la nueva forma de inicializar propiedades p5 personalizadas para cualquier instancia en p5.
// El objetivo es migrar las propiedades perezosas de P5 a este método.
// @see https://github.com/molleindustria/p5.play/issues/46
p5.prototype.registerMethod('init', function p5PlayInit() {
  /**
   * La cámara de bocetos se crea automáticamente al comienzo de un boceto.
   * Una cámara facilita el desplazamiento y el zoom para escenas que se extienden más allá
   * del lienzo. Una cámara tiene una posición, un factor de zoom y el ratón
   * coordina relativas a la vista.
   *
   * En términos de p5.js, la cámara envuelve todo el ciclo de dibujo en una
   * matriz de transformación, pero se puede desactivar en cualquier momento durante el ciclo de
   * dibujo, por ejemplo para dibujar elementos de interfaz en una posición absoluta.
   *
   * @property camera   @propiedad cámara
   * @type {camera}     @tipo {cámara}
   */
  this.camera = new Camera(this, 0, 0, 1);
  this.camera.init = false;

  this.angleMode(this.DEGREES);
  this.frameRate(DEFAULT_FRAME_RATE);

  this._defaultCanvasSize = {
    width: 400,
    height: 400
  };

  var startDate = new Date();
  this._startTime = startDate.getTime();

  // Lienzo temporal para soportar operaciones de tinte a partir de elementos de imagen;s;
  // mira p5.prototype.imageElement()
  this._tempCanvas = document.createElement('canvas');
});

// Esto nos proporciona una forma de definir perezosamente propiedades que
// son globales para instancias p5.
//
// Ten en cuenta que esto no es solo una optimización: p5 actualmente no proporciona
// una forma de que se notifique a los complementos cuando se creen nuevas instancias p5, por lo que
// la creación perezosa de estas propiedades es el * único * mecanismo disponible
// para nosotros. Para más información, visita:
//
// https://github.com/processing/p5.js/issues/1263
function defineLazyP5Property(name, getter) {
  Object.defineProperty(p5.prototype, name, {
    configurable: true,
    enumerable: true,
    get: function() {
      var context = (this instanceof p5 && !this._isGlobal) ? this : window;

      if (typeof(context._p5PlayProperties) === 'undefined') {
        context._p5PlayProperties = {};
      }
      if (!(name in context._p5PlayProperties)) {
        context._p5PlayProperties[name] = getter.call(context);
      }
      return context._p5PlayProperties[name];
    }
  });
}

// Esto devuelve una función de fábrica, adecuada para pasar a
// defineLazyP5Property, que devuelve una sublclase del constructor
// dado, que siempre está vinculado a una instancia p5 particular.
function boundConstructorFactory(constructor) {
  if (typeof(constructor) !== 'function')
    throw new Error('el constructor debe ser una función');

  return function createBoundConstructor() {
    var pInst = this;

    function F() {
      var args = Array.prototype.slice.call(arguments);

      return constructor.apply(this, [pInst].concat(args));
    }
    F.prototype = constructor.prototype;

    return F;
  };
}

// Esta es una utilidad que facilita la definición de alias convenientes para
// métodos de instancia de p5 pre-enlazados.
//
// Por ejemplo:
//
//   var pInstBind = createPInstBinder(pInst);
//
//   var createVector = pInstBind('createVector');
//   var loadImage = pInstBind('loadImage');
//
// Lo anterior creará funciones createVector y loadImage, que pueden ser
// usadas de manera similar al modo global p5; sin embargo, están vinculadas a instancias p5 
// específicas,  y por lo tanto se puede usar fuera del modo global.
function createPInstBinder(pInst) {
  return function pInstBind(methodName) {
    var method = pInst[methodName];

    if (typeof(method) !== 'function')
      throw new Error('"' + methodName + '" no es un método p5');
    return method.bind(pInst);
  };
}

// Estas son funciones de utilidad p5 que no dependen del estado de la instancia p5
// para que funcionen correctamente, así que seguiremos adelante y facilitaremos su
// accesso sin necesidad de vincularlas a una instancia p5.
var abs = p5.prototype.abs;
var radians = p5.prototype.radians;
var degrees = p5.prototype.degrees;

// =============================================================================
//                        anulación p5
// =============================================================================

// Establece el color de relleno predeterminado en gris (127, 127, 127) cada vez que se crea un nuevo
// lienzo.
if (!p5.prototype.originalCreateCanvas_) {
  p5.prototype.originalCreateCanvas_ = p5.prototype.createCanvas;
  p5.prototype.createCanvas = function() {
    var result = this.originalCreateCanvas_.apply(this, arguments);
    this.fill(this.color(127, 127, 127));
    return result;
  };
}

// Haz que el ancho y el alto sean opcionales para elipse () - predeterminado en 50
// Guarda la implementación original para permitir parámetros opcionales.
if (!p5.prototype.originalEllipse_) {
  p5.prototype.originalEllipse_ = p5.prototype.ellipse;
  p5.prototype.ellipse = function(x, y, w, h) {
    w = (w) ? w : 50;
    h = (w && !h) ? w : h;
    this.originalEllipse_(x, y, w, h);
  };
}

// Haz que el ancho y el alto sean opcionales para rect () - predeterminado en 50
// Guarda la implementación original para permitir parámetros opcionales.
if (!p5.prototype.originalRect_) {
  p5.prototype.originalRect_ = p5.prototype.rect;
  p5.prototype.rect = function(x, y, w, h) {
    w = (w) ? w : 50;
    h = (w && !h) ? w : h;
    this.originalRect_(x, y, w, h);
  };
}

// Modifica p5 para ignorar las posiciones fuera de límites antes de configurar touchIsDown
p5.prototype._ontouchstart = function(e) {
  if (!this._curElement) {
    return;
  }
  var validTouch;
  for (var i = 0; i < e.touches.length; i++) {
    validTouch = getTouchInfo(this._curElement.elt, e, i);
    if (validTouch) {
      break;
    }
  }
  if (!validTouch) {
    // No hay toques dentro de los límites (válidos), regresa e ignora:
    return;
  }
  var context = this._isGlobal ? window : this;
  var executeDefault;
  this._updateNextTouchCoords(e);
  this._updateNextMouseCoords(e);
  this._setProperty('touchIsDown', true);
  if (typeof context.touchStarted === 'function') {
    executeDefault = context.touchStarted(e);
    if (executeDefault === false) {
      e.preventDefault();
    }
  } else if (typeof context.mousePressed === 'function') {
    executeDefault = context.mousePressed(e);
    if (executeDefault === false) {
      e.preventDefault();
    }
    //this._setMouseButton(e);
  }
};

// Modifica p5 para manejar las transformaciones CSS (escala), e ignora las posiciones fuera del
// límite antes de informar las coordenadas táctiles
//
// NOTA: _updateNextTouchCoords () es casi idéntico, pero llama a una función modificada
// getTouchInfo() que escala la posición táctil con el espacio
// del juego, y puede devolver indefinido
p5.prototype._updateNextTouchCoords = function(e) {
  var x = this.touchX;
  var y = this.touchY;
  if (e.type === 'mousedown' || e.type === 'mousemove' ||
      e.type === 'mouseup' || !e.touches) {
    x = this.mouseX;
    y = this.mouseY;
  } else {
    if (this._curElement !== null) {
      var touchInfo = getTouchInfo(this._curElement.elt, e, 0);
      if (touchInfo) {
        x = touchInfo.x;
        y = touchInfo.y;
      }

      var touches = [];
      var touchIndex = 0;
      for (var i = 0; i < e.touches.length; i++) {
        // Solo algunos toques son válidos - solo presione toques válidos en el arreglo 
        // de la matriz para matriz para la propiedad `touch`
        touchInfo = getTouchInfo(this._curElement.elt, e, i);
        if (touchInfo) {
          touches[touchIndex] = touchInfo;
          touchIndex++;
        }
      }
      this._setProperty('touches', touches);
    }
  }
  this._setProperty('touchX', x);
  this._setProperty('touchY', y);
  if (!this._hasTouchInteracted) {
    // Para el primer dibujo, haz que el anterior y el siguiente sean iguales
    this._updateTouchCoords();
    this._setProperty('_hasTouchInteracted', true);
  }
};

// NOTA: devuelve indefinido si la posición está fuera del rango válido
function getTouchInfo(canvas, e, i) {
  i = i || 0;
  var rect = canvas.getBoundingClientRect();
  var touch = e.touches[i] || e.changedTouches[i];
  var xPos = touch.clientX - rect.left;
  var yPos = touch.clientY - rect.top;
  if (xPos >= 0 && xPos < rect.width && yPos >= 0 && yPos < rect.height) {
    return {
      x: Math.round(xPos * canvas.offsetWidth / rect.width),
      y: Math.round(yPos * canvas.offsetHeight / rect.height),
      id: touch.identifier
    };
  }
}

// Modifica p5 para ignorar las posiciones fuera de límites antes de configurar mouseIsPressed
// y isMousePressed
p5.prototype._onmousedown = function(e) {
  if (!this._curElement) {
    return;
  }
  if (!getMousePos(this._curElement.elt, e)) {
    // No está dentro de los límites, regresa e ignora:
    return;
  }
  var context = this._isGlobal ? window : this;
  var executeDefault;
  this._setProperty('isMousePressed', true);
  this._setProperty('mouseIsPressed', true);
  this._setMouseButton(e);
  this._updateNextMouseCoords(e);
  this._updateNextTouchCoords(e);
  if (typeof context.mousePressed === 'function') {
    executeDefault = context.mousePressed(e);
    if (executeDefault === false) {
      e.preventDefault();
    }
  } else if (typeof context.touchStarted === 'function') {
    executeDefault = context.touchStarted(e);
    if (executeDefault === false) {
      e.preventDefault();
    }
  }
};

// Modifica p5 para manejar las transformaciones CSS (escala) e ignorar las posiciones
// fuera de límites antes de informar las coordenadas del ratón
//
// NOTA: _updateNextMouseCoords () es casi idéntico, pero llama debajo a una función modificada
// getMousePos() que escala la posición del espacio del juego
// y puede devolver indefinido.
p5.prototype._updateNextMouseCoords = function(e) {
  var x = this.mouseX;
  var y = this.mouseY;
  if (e.type === 'touchstart' || e.type === 'touchmove' ||
      e.type === 'touchend' || e.touches) {
    x = this.touchX;
    y = this.touchY;
  } else if (this._curElement !== null) {
    var mousePos = getMousePos(this._curElement.elt, e);
    if (mousePos) {
      x = mousePos.x;
      y = mousePos.y;
    }
  }
  this._setProperty('mouseX', x);
  this._setProperty('mouseY', y);
  this._setProperty('winMouseX', e.pageX);
  this._setProperty('winMouseY', e.pageY);
  if (!this._hasMouseInteracted) {
    // Para el primer dibujo, haz que el anterior y el siguiente sean iguales
    this._updateMouseCoords();
    this._setProperty('_hasMouseInteracted', true);
  }
};

// NOTA: devuelve indefinido si la posición está fuera del rango válido
function getMousePos(canvas, evt) {
  var rect = canvas.getBoundingClientRect();
  var xPos = evt.clientX - rect.left;
  var yPos = evt.clientY - rect.top;
  if (xPos >= 0 && xPos < rect.width && yPos >= 0 && yPos < rect.height) {
    return {
      x: Math.round(xPos * canvas.offsetWidth / rect.width),
      y: Math.round(yPos * canvas.offsetHeight / rect.height)
    };
  }
}

// =============================================================================
//                         extensiones p5
// TODO: Estaría geniial que se aceptaran en la p5.
// =============================================================================

/**
 * Proyecta un vector en la línea paralela a un segundo vector, dando un tercer
 * vector que es la proyección ortogonal de ese vector sobre la línea.
 * @see https://en.wikipedia.org/wiki/Vector_projection
 * @method project
 * @for p5.Vector
 * @static
 * @param {p5.Vector} a - vector que se proyecta
 * @param {p5.Vector} b - vector que define la línea objetivo de proyección.
 * @return {p5.Vector} projection of a onto the line parallel to b.
 */
p5.Vector.project = function(a, b) {
  return p5.Vector.mult(b, p5.Vector.dot(a, b) / p5.Vector.dot(b, b));
};

/**
 * Pregunta si un vector es paralelo a éste.
 * @method isParallel
 * @for p5.Vector
 * @param {p5.Vector} v2
 * @param {number} [tolerance] - margen de error para las comparaciones, entra en
 *        juego al comparar vectores rotados. Por ejemplo, queremos
 *        <1, 0> que sea paralelo a <0, 1>.rot(Math.PI/2) pero la imprecisión flotante
 *        puede interferir con eso.
 * @return {boolean}
 */
p5.Vector.prototype.isParallel = function(v2, tolerance) {
  tolerance = typeof tolerance === 'number' ? tolerance : 1e-14;
  return (
      Math.abs(this.x) < tolerance && Math.abs(v2.x) < tolerance
    ) || (
      Math.abs(this.y ) < tolerance && Math.abs(v2.y) < tolerance
    ) || (
      Math.abs(this.x / v2.x - this.y / v2.y) < tolerance
    );
};

// =============================================================================
//                         adiciones p5
// =============================================================================

/**
 * Carga una imagen de una ruta y crea una imagen a partir de ella.
 * <br><br>
 * Es posible que la imagen no esté disponible inmediatamente para renderizar
 * Si deseas asegurarse de que la imagen esté lista antes de hacer
 * cualquier cosa con ella, coloca la loadImageElement() llamada en preload().
 * También puedes proporcionar una función de devolución de llamada para manejar la imagen cuando esté lista.
 * <br><br>
 * La ruta a la imagen debe ser relativa al archivo HTML
 * que enlaza en tu boceto. Cargando un desde una URL u otra
 * ubicación remota, puede estar bloqueada debido a la seguridad integrada
 * de tu navegador.
 *
 * @method loadImageElement
 * @param  {String} path Ruta de la imagen a cargar
 * @param  {Function(Image)} [successCallback] Función a llamar una vez que la
 *                                imagen está cargada. Se pasará la
 *                                Imagen.
 * @param  {Function(Event)}    [failureCallback] llamada con error de evento si
 *                                la imagen falla al cargar.
 * @return {Image}                el objeto Imagen 
 */
p5.prototype.loadImageElement = function(path, successCallback, failureCallback) {
  var img = new Image();
  var decrementPreload = p5._getDecrementPreload.apply(this, arguments);

  img.onload = function() {
    if (typeof successCallback === 'function') {
      successCallback(img);
    }
    if (decrementPreload && (successCallback !== decrementPreload)) {
      decrementPreload();
    }
  };
  img.onerror = function(e) {
    p5._friendlyFileLoadError(0, img.src);
    // no mezcles la devolución de llamada de falla con decrementPreload
    if ((typeof failureCallback === 'function') &&
      (failureCallback !== decrementPreload)) {
      failureCallback(e);
    }
  };

  //establece crossOrigin en caso de que se sirva una imagen con encabezados CORS
  //esto nos permitirá dibujar sobre el lienzo sin mancharlo.
  //mira https://developer.mozilla.org/en-US/docs/HTML/CORS_Enabled_Image
  // Al usar data-uris, el archivo se cargará localmente
  // por lo que no tenemos que preocuparnos por crossOrigin con tipos de archivos base64
  if(path.indexOf('data:image/') !== 0) {
    img.crossOrigin = 'Anonymous';
  }

  //empieza a cargar la imagen
  img.src = path;

  return img;
};

/**
 * Dibuja un elemento de imagen en el lienzo principal del boceto de p5js
 *
 * @method imageElement
 * @param  {Image}    imgEl    la imagen para mostrar
 * @param  {Number}   [sx=0]   La coordenada X de la esquina superior izquierda del
 *                             sub-rectángulo de la imagen de origen para dibujar en
 *                             el lienzo de destino.
 * @param  {Number}   [sy=0]   La coordenada Y de la esquina superior izquierda del
 *                             sub-rectángulo de la imagen de origen para dibujar en
 *                             el lienzo de destino.
 * @param {Number} [sWidth=imgEl.width] El ancho del sub-rectángulo de la
 *                                      imagen de origen para dibujar en 
 *                                      el lienzo de destino.
 * @param {Number} [sHeight=imgEl.height] La altura del sub-rectángulo de la
 *                                        imagen de origen para dibujar en el
 *                                        contexto de destino.
 * @param  {Number}   [dx=0]    La coordenada X en el lienzo de destino en el 
 *                              cuál colocar en la esquina superior izquierda de la
 *                              imagen de origen.
 * @param  {Number}   [dy=0]    La coordenada Y en el lienzo de destino en el 
 *                              cuál colocar en la esquina superior izquierda de la
 *                              imagen de origen.
 * @param  {Number}   [dWidth]  El ancho para dibujar la imagen en el lienzo de
 *                              destino. Esto permite escalar la imagen dibujada.
 * @param  {Number}   [dHeight] La altura para dibujar la imagen en el lienzo
 *                              de destino. Esto permite escalar la imagen dibujada.
 * @example
 * <div>
 * <code>
 * var imgEl;
 * function preload() {
 *   imgEl = loadImageElement("assets/laDefense.jpg");
 * }
 * function setup() {
 *   imageElement(imgEl, 0, 0);
 *   imageElement(imgEl, 0, 0, 100, 100);
 *   imageElement(imgEl, 0, 0, 100, 100, 0, 0, 100, 100);
 * }
 * </code>
 * </div>
 * <div>
 * <code>
 * function setup() {
 *   // aquí usamos una devolución de llamada para mostrar la imagen después de cargarla
 *   loadImageElement("assets/laDefense.jpg", function(imgEl) {
 *     imageElement(imgEl, 0, 0);
 *   });
 * }
 * </code>
 * </div>
 *
 * @alt
 * imagen de la parte inferior de un paraguas blanco, y de un techo a rayas encima
 * imagen de la parte inferior de un paraguas blanco, y de un techo a rayas encima
 *
 */
p5.prototype.imageElement = function(imgEl, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight) {
  /**
   * Valida los parámetros de recorte. Según las especificaciones de drawImage, sWidth y sHight no pueden serr
   * negativos o mayor que el ancho y alto intrínsecos de la imagen
   * @private
   * @param {Number} sVal
   * @param {Number} iVal
   * @returns {Number}
   * @private
   */
  function _sAssign(sVal, iVal) {
    if (sVal > 0 && sVal < iVal) {
      return sVal;
    }
    else {
      return iVal;
    }
  }

  function modeAdjust(a, b, c, d, mode) {
    if (mode === p5.prototype.CORNER) {
      return {x: a, y: b, w: c, h: d};
    } else if (mode === p5.prototype.CORNERS) {
      return {x: a, y: b, w: c-a, h: d-b};
    } else if (mode === p5.prototype.RADIUS) {
      return {x: a-c, y: b-d, w: 2*c, h: 2*d};
    } else if (mode === p5.prototype.CENTER) {
      return {x: a-c*0.5, y: b-d*0.5, w: c, h: d};
    }
  }

  if (arguments.length <= 5) {
    dx = sx || 0;
    dy = sy || 0;
    sx = 0;
    sy = 0;
    dWidth = sWidth || imgEl.width;
    dHeight = sHeight || imgEl.height;
    sWidth = imgEl.width;
    sHeight = imgEl.height;
  } else if (arguments.length === 9) {
    sx = sx || 0;
    sy = sy || 0;
    sWidth = _sAssign(sWidth, imgEl.width);
    sHeight = _sAssign(sHeight, imgEl.height);

    dx = dx || 0;
    dy = dy || 0;
    dWidth = dWidth || imgEl.width;
    dHeight = dHeight || imgEl.height;
  } else {
    throw 'Wrong number of arguments to imageElement()';
  }

  var vals = modeAdjust(dx, dy, dWidth, dHeight,
    this._renderer._imageMode);

  if (this._renderer._tint) {
    // Crear / dibujar justo a tiempo en un lienzo temporal para que el teñido pueda
    // trabaja dentro del renderizador como lo haría para una p5.Imagen
    // Solo cambia el tamaño del lienzo si es demasiado pequeño
    var context = this._tempCanvas.getContext('2d');
    if (this._tempCanvas.width < vals.w || this._tempCanvas.height < vals.h) {
      this._tempCanvas.width = Math.max(this._tempCanvas.width, vals.w);
      this._tempCanvas.height = Math.max(this._tempCanvas.height, vals.h);
    } else {
      context.clearRect(0, 0, vals.w, vals.h);
    }
    context.drawImage(imgEl,
      sx, sy, sWidth, sHeight,
      0, 0, vals.w, vals.h);
    // Llama al método image() del renderizador con un objeto que contenga la imagen
    // como una propiedad 'elt', y también el lienzo temporal (cuando sea necesario):
    this._renderer.image({canvas: this._tempCanvas},
      0, 0, vals.w, vals.h,
      vals.x, vals.y, vals.w, vals.h);
  } else {
    this._renderer.image({elt: imgEl},
      sx, sy, sWidth, sHeight,
      vals.x, vals.y, vals.w, vals.h);
  }
};

/**
* Un grupo que contiene todos los sprites del boceto.
*
* @property allSprites
* @for p5.play
* @type {Group}
*/

defineLazyP5Property('allSprites', function() {
  return new p5.prototype.Group();
});

p5.prototype._mouseButtonIsPressed = function(buttonCode) {
  return (this.mouseIsPressed && this.mouseButton === buttonCode) ||
    (this.touchIsDown && buttonCode === this.LEFT);
};

p5.prototype.mouseDidMove = function() {
  return this.pmouseX !== this.mouseX || this.pmouseY !== this.mouseY;
};

p5.prototype.mouseIsOver = function(sprite) {
  if (!sprite) {
    return false;
  }

  if (!sprite.collider) {
    sprite.setDefaultCollider();
  }

  var mousePosition;
  if (this.camera.active) {
    mousePosition = this.createVector(this.camera.mouseX, this.camera.mouseY);
  } else {
    mousePosition = this.createVector(this.mouseX, this.mouseY);
  }

  return sprite.collider.overlap(new window.p5.PointCollider(mousePosition));
};

p5.prototype.mousePressedOver = function(sprite) {
  return (this.mouseIsPressed || this.touchIsDown) && this.mouseIsOver(sprite);
};

var styleEmpty = 'rgba(0,0,0,0)';

p5.Renderer2D.prototype.regularPolygon = function(x, y, sides, size, rotation) {
  var ctx = this.drawingContext;
  var doFill = this._doFill, doStroke = this._doStroke;
  if (doFill && !doStroke) {
    if (ctx.fillStyle === styleEmpty) {
      return this;
    }
  } else if (!doFill && doStroke) {
    if (ctx.strokeStyle === styleEmpty) {
      return this;
    }
  }
  if (sides < 3) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + size * Math.cos(rotation), y + size * Math.sin(rotation));
  for (var i = 1; i < sides; i++) {
    var angle = rotation + (i * 2 * Math.PI / sides);
    ctx.lineTo(x + size * Math.cos(angle), y + size * Math.sin(angle));
  }
  ctx.closePath();
  if (doFill) {
    ctx.fill();
  }
  if (doStroke) {
    ctx.stroke();
  }
};

p5.prototype.regularPolygon = function(x, y, sides, size, rotation) {
  if (!this._renderer._doStroke && !this._renderer._doFill) {
    return this;
  }
  var args = new Array(arguments.length);
  for (var i = 0; i < args.length; ++i) {
    args[i] = arguments[i];
  }

  if (typeof rotation === 'undefined') {
    rotation = -(Math.PI / 2);
    if (0 === sides % 2) {
      rotation += Math.PI / sides;
    }
  } else if (this._angleMode === this.DEGREES) {
    rotation = this.radians(rotation);
  }

  // NOTA: solo implementado para no 3D
  if (!this._renderer.isP3D) {
    this._validateParameters(
      'regularPolygon',
      args,
      [
        ['Number', 'Number', 'Number', 'Number'],
        ['Number', 'Number', 'Number', 'Number', 'Number']
      ]
    );
    this._renderer.regularPolygon(
      args[0],
      args[1],
      args[2],
      args[3],
      rotation
    );
  }
  return this;
};

p5.Renderer2D.prototype.shape = function() {
  var ctx = this.drawingContext;
  var doFill = this._doFill, doStroke = this._doStroke;
  if (doFill && !doStroke) {
    if (ctx.fillStyle === styleEmpty) {
      return this;
    }
  } else if (!doFill && doStroke) {
    if (ctx.strokeStyle === styleEmpty) {
      return this;
    }
  }
  var numCoords = arguments.length / 2;
  if (numCoords < 1) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(arguments[0], arguments[1]);
  for (var i = 1; i < numCoords; i++) {
    ctx.lineTo(arguments[i * 2], arguments[i * 2 + 1]);
  }
  ctx.closePath();
  if (doFill) {
    ctx.fill();
  }
  if (doStroke) {
    ctx.stroke();
  }
};

p5.prototype.shape = function() {
  if (!this._renderer._doStroke && !this._renderer._doFill) {
    return this;
  }
  // NOTA: solo implementado para no 3D
  if (!this._renderer.isP3D) {
    // TODO: llama a this._validateParameters, una vez que esté funcionando en p5.js y
    // entendemos si se puede usar para funciones var args como esta
    this._renderer.shape.apply(this._renderer, arguments);
  }
  return this;
};

p5.prototype.rgb = function(r, g, b, a) {
  // convierte a de 0 a 255 a 0 a 1
  if (!a) {
    a = 1;
  }
  a = a * 255;

  return this.color(r, g, b, a);
};

p5.prototype.createGroup = function() {
  return new this.Group();
};

defineLazyP5Property('World', function() {
  var World = {
    pInst: this
  };

  function createReadOnlyP5PropertyAlias(name) {
    Object.defineProperty(World, name, {
      enumerable: true,
      get: function() {
        return this.pInst[name];
      }
    });
  }

  createReadOnlyP5PropertyAlias('width');
  createReadOnlyP5PropertyAlias('height');
  createReadOnlyP5PropertyAlias('mouseX');
  createReadOnlyP5PropertyAlias('mouseY');
  createReadOnlyP5PropertyAlias('allSprites');
  createReadOnlyP5PropertyAlias('frameCount');

  Object.defineProperty(World, 'frameRate', {
    enumerable: true,
    get: function() {
      return this.pInst.frameRate();
    },
    set: function(value) {
      this.pInst.frameRate(value);
    }
  });

  Object.defineProperty(World, 'seconds', {
    enumerable: true,
    get: function() {
      var currentDate = new Date();
      var currentTime = currentDate.getTime();
      return Math.round((currentTime - this.pInst._startTime) / 1000);
    }
  });

  return World;
});

p5.prototype.spriteUpdate = true;

/**
   * Un Sprite es el componente principal de p5.play
   * un elemento capaz de almacenar imágenes o animaciones con un conjunto de
   * propiedades como posición y visibilidad.
   * Un Sprite puede tener un colisionador que define el área activa para detectar
   * colisiones o superposiciones con otros sprites e interacciones del ratón.
   *
   * Los Sprites creados con createSprite (la forma preferida) se agregan al
   * grupo allSprites y se le da un valor de profundidad que lo coloca al frente de todos
   * los otros sprites.
   *
   * @method createSprite
   * @param {Number} x Coordenada x inicial
   * @param {Number} y Coordenada y inicial
   * @param {Number} width Ancho del rectángulo del marcador de posición y del
   *                       colisionador hasta que se establezca una imagen o un nuevo colisionador
   * @param {Number} height Altura del rectángulo del marcador de posición y del
   *                       colisionador hasta que se establezca una imagen o un nuevo colisionador
   * @return {Object} La nueva instancia del sprite
   */

p5.prototype.createSprite = function(x, y, width, height) {
  var s = new Sprite(this, x, y, width, height);
  s.depth = this.allSprites.maxDepth()+1;
  this.allSprites.add(s);
  return s;
};


/**
   * Elimina un Sprite del boceto.
   * El Sprite eliminado ya no se dibujará ni actualizará.
   * Equivalente a Sprite.remove()
   *
   * @method removeSprite
   * @param {Object} sprite Sprite que se eliminará
*/
p5.prototype.removeSprite = function(sprite) {
  sprite.remove();
};

/**
* Actualiza todos los sprites en el boceto (posición, animación ...)
* se llama automáticamente en cada draw().
* Se puede pausar pasando un parámetro verdadero o falso;
* Nota: no renderiza los sprites.
*
* @method updateSprites
* @param {Boolean} actualizando falso para pausar la actualización, verdadero para reanudar
*/
p5.prototype.updateSprites = function(upd) {

  if(upd === false)
    this.spriteUpdate = false;
  if(upd === true)
    this.spriteUpdate = true;

  if(this.spriteUpdate)
  for(var i = 0; i<this.allSprites.size(); i++)
  {
    this.allSprites.get(i).update();
  }
};

/**
* Rdevuelve todos los sprites en el boceto como una matriz
*
* @method getSprites
* @return {Array} Matriz de Sprites
*/
p5.prototype.getSprites = function() {

  //dibuja todo 
  if(arguments.length===0)
  {
    return this.allSprites.toArray();
  }
  else
  {
    var arr = [];
    //para cada etiqueta
    for(var j=0; j<arguments.length; j++)
    {
      for(var i = 0; i<this.allSprites.size(); i++)
      {
        if(this.allSprites.get(i).isTagged(arguments[j]))
          arr.push(this.allSprites.get(i));
      }
    }

    return arr;
  }

};

/**
* Displays a Group of sprites.
* Si no se especifica ningún parámetro, dibuja todos los sprites en el
* boceto.
* El orden de dibujo está determinado por la propiedad Sprite "profundidad"
*
* @method drawSprites
* @param {Group} [group] Grupo de Sprites que se mostrarán
*/
p5.prototype.drawSprites = function(group) {
  // Si no se proporciona ningún grupo, dibuja el grupo allSprites.
  group = group || this.allSprites;

  if (typeof group.draw !== 'function')
  {
    throw('Error: with drawSprites you can only draw all sprites or a group');
  }

  group.draw();
};

/**
* Muestra un Sprite.
* Se utiliza normalmente en la función de dibujo principal.
*
* @method drawSprite
* @param {Sprite} sprite Sprite que se mostrará
*/
p5.prototype.drawSprite = function(sprite) {
  if(sprite)
  sprite.display();
};

/**
* Carga una animación.
* Se utiliza normalmente en la función preload() del boceto.
*
* @method loadAnimation
* @param {Sprite} sprite Sprite que se mostrará
*/
p5.prototype.loadAnimation = function() {
  return construct(this.Animation, arguments);
};

/**
 * Carga una Hoja de Sprite.
 * Para ser usado típicamente en la función preload() del boceto.
 *
 * @method loadSpriteSheet
 */
p5.prototype.loadSpriteSheet = function() {
  return construct(this.SpriteSheet, arguments);
};

/**
* Muestra una animación.
*
* @method animation
* @param {Animation} anim Animación que se mostrará
* @param {Number} x coordenada X 
* @param {Number} y coordenada Y 
*
*/
p5.prototype.animation = function(anim, x, y) {
  anim.draw(x, y);
};

//variable para detectar una presión instantánea
defineLazyP5Property('_p5play', function() {
  return {
    keyStates: {},
    mouseStates: {}
  };
});

var KEY_IS_UP = 0;
var KEY_WENT_DOWN = 1;
var KEY_IS_DOWN = 2;
var KEY_WENT_UP = 3;

/**
* Detecta si se presionó una tecla durante el último ciclo.
* Se puede usar para activar eventos una vez, cuando se presiona o suelta una tecla.
* Ejemplo: Super Mario saltando.
*
* @method keyWentDown
* @param {Number|String} key Código clave o caracter
* @return {Boolean} Verdadero si se presionó la tecla
*/
p5.prototype.keyWentDown = function(key) {
  return this._isKeyInState(key, KEY_WENT_DOWN);
};


/**
* Detecta si se soltó una tecla durante el último ciclo.
* Se puede usar para activar eventos una vez, cuando se presiona o suelta una tecla.
* Ejemplo: Disparo de una nave espacial.
*
* @method keyWentUp
* @param {Number|String} key Código clave o caracter
* @return {Boolean} Verdadero si se presionó la tecla
*/
p5.prototype.keyWentUp = function(key) {
  return this._isKeyInState(key, KEY_WENT_UP);
};

/**
* Detecta si una tecla está presionada actualmente
* Como p5 keyIsDown pero acepta cadenas y códigos
*
* @method keyDown
* @param {Number|String} key Código clave o caracter
* @return {Boolean} Verdadero si se presionó la tecla
*/
p5.prototype.keyDown = function(key) {
  return this._isKeyInState(key, KEY_IS_DOWN);
};

/**
* Detecta si una tecla está en el estado dado durante el último ciclo.
 * Método auxiliar que encapsula la lógica de estado de clave común; puede ser preferible
 * para llamar a keyDown u otros métodos directamente.
 *
 * @private
 * @method _isKeyInState
 * @param {Number|String} key Código clave o caracter
 * @param {Number} state Estado clave para verificar
 * @return {Boolean} Verdadero si la clave está en el estado dado
 */
p5.prototype._isKeyInState = function(key, state) {
  var keyCode;
  var keyStates = this._p5play.keyStates;

  if(typeof key === 'string')
  {
    keyCode = this._keyCodeFromAlias(key);
  }
  else
  {
    keyCode = key;
  }

  //si no está definido, empieza a comprobarlo
  if(keyStates[keyCode]===undefined)
  {
    if(this.keyIsDown(keyCode))
      keyStates[keyCode] = KEY_IS_DOWN;
    else
      keyStates[keyCode] = KEY_IS_UP;
  }

  return (keyStates[keyCode] === state);
};

/**
* Detecta si un botón del ratón está presionado actualmente
* Combina mouseIsPressed y mouseButton de p5
*
* @method mouseDown
* @param {Number} [buttonCode] Botón del ratón constante IZQUIERDA, DERECHA o CENTRO
* @return {Boolean} Verdadero si el botón está presionado
*/
p5.prototype.mouseDown = function(buttonCode) {
  return this._isMouseButtonInState(buttonCode, KEY_IS_DOWN);
};

/**
* Detecta si un botón del ratón está presionado actualmente
* Combina mouseIsPressed y mouseButton de p5
*
* @method mouseUp
* @param {Number} [buttonCode] Botón del mouse constante IZQUIERDA, DERECHA o CENTRO
* @return {Boolean} Verdadero si el botón está arriba
*/
p5.prototype.mouseUp = function(buttonCode) {
  return this._isMouseButtonInState(buttonCode, KEY_IS_UP);
};

/**
 * Detecta si se soltó un botón del ratón durante el último ciclo.
 * Se puede usar para activar eventos una vez, para verificarlo en el ciclo de extracción.
 *
 * @method mouseWentUp
 * @param {Number} [buttonCode] Botón del mouse constante IZQUIERDA, DERECHA o CENTRO
 * @return {Boolean} Verdadero si se acaba de soltar el botón
 */
p5.prototype.mouseWentUp = function(buttonCode) {
  return this._isMouseButtonInState(buttonCode, KEY_WENT_UP);
};


/**
 * Detecta si se presionó un botón del mouse durante el último ciclo.
 * Se puede usar para activar eventos una vez, para verificarlo en el ciclo de extracción.
 *
 * @method mouseWentDown
 * @param {Number} [buttonCode] Botón del mouse constante IZQUIERDA, DERECHA o CENTRO
 * @return {Boolean} Verdadero si se acaba de presionar el botón
 */
p5.prototype.mouseWentDown = function(buttonCode) {
  return this._isMouseButtonInState(buttonCode, KEY_WENT_DOWN);
};

/**
 * Devuelve una constante para un estado del ratón dada una cadena o una constante de botón del ratón.
 *
 * @private
 * @method _clickKeyFromString
 * @param {Number|String} [buttonCode] Botón del mouse constante IZQUIERDA, DERECHA o CENTRO
 *   or string 'leftButton', 'rightButton', or 'centerButton'
 * @return {Number} Botón del ratón constante IZQUIERDA, DERECHA o CENTRO o valor de buttonCode
 */
p5.prototype._clickKeyFromString = function(buttonCode) {
  if (this.CLICK_KEY[buttonCode]) {
    return this.CLICK_KEY[buttonCode];
  } else {
    return buttonCode;
  }
};

// Mapa de cadenas a constantes para estados del ratón.
p5.prototype.CLICK_KEY = {
  'leftButton': p5.prototype.LEFT,
  'rightButton': p5.prototype.RIGHT,
  'centerButton': p5.prototype.CENTER
};

/**
 * Detecta si un botón del ratón está en el estado dado durante el último ciclo.
 * Método auxiliar que encapsula la lógica del estado del botón del ratóncomún; Puede ser
 * preferible llamar directamente a mouseWentUp, etc.
 *
 * @private
 * @method _isMouseButtonInState
 * @param {Number|String} [buttonCode] Botón del ratón constante IZQUIERDA, DERECHA o CENTRO
 *   or string 'leftButton', 'rightButton', or 'centerButton'
 * @param {Number} state
 * @return {boolean} Verdadero si el botón estaba en el estado dado
 */
p5.prototype._isMouseButtonInState = function(buttonCode, state) {
  var mouseStates = this._p5play.mouseStates;

  buttonCode = this._clickKeyFromString(buttonCode);

  if(buttonCode === undefined)
    buttonCode = this.LEFT;

  //indefinido = aún no se ha rastreado, comenzar a rastrear
  if(mouseStates[buttonCode]===undefined)
  {
  if (this._mouseButtonIsPressed(buttonCode))
    mouseStates[buttonCode] = KEY_IS_DOWN;
  else
    mouseStates[buttonCode] = KEY_IS_UP;
  }

  return (mouseStates[buttonCode] === state);
};


/**
 * Un objeto que almacena todas las claves útiles para un fácil acceso
 * Key.tab = 9
 *
 * @private
 * @property KEY
 * @type {Object}
 */
p5.prototype.KEY = {
    'BACKSPACE': 8,
    'TAB': 9,
    'ENTER': 13,
    'SHIFT': 16,
    'CTRL': 17,
    'ALT': 18,
    'PAUSE': 19,
    'CAPS_LOCK': 20,
    'ESC': 27,
    'SPACE': 32,
    ' ': 32,
    'PAGE_UP': 33,
    'PAGE_DOWN': 34,
    'END': 35,
    'HOME': 36,
    'LEFT_ARROW': 37,
    'LEFT': 37,
    'UP_ARROW': 38,
    'UP': 38,
    'RIGHT_ARROW': 39,
    'RIGHT': 39,
    'DOWN_ARROW': 40,
    'DOWN': 40,
    'INSERT': 45,
    'DELETE': 46,
    '0': 48,
    '1': 49,
    '2': 50,
    '3': 51,
    '4': 52,
    '5': 53,
    '6': 54,
    '7': 55,
    '8': 56,
    '9': 57,
    'A': 65,
    'B': 66,
    'C': 67,
    'D': 68,
    'E': 69,
    'F': 70,
    'G': 71,
    'H': 72,
    'I': 73,
    'J': 74,
    'K': 75,
    'L': 76,
    'M': 77,
    'N': 78,
    'O': 79,
    'P': 80,
    'Q': 81,
    'R': 82,
    'S': 83,
    'T': 84,
    'U': 85,
    'V': 86,
    'W': 87,
    'X': 88,
    'Y': 89,
    'Z': 90,
    '0NUMPAD': 96,
    '1NUMPAD': 97,
    '2NUMPAD': 98,
    '3NUMPAD': 99,
    '4NUMPAD': 100,
    '5NUMPAD': 101,
    '6NUMPAD': 102,
    '7NUMPAD': 103,
    '8NUMPAD': 104,
    '9NUMPAD': 105,
    'MULTIPLY': 106,
    'PLUS': 107,
    'MINUS': 109,
    'DOT': 110,
    'SLASH1': 111,
    'F1': 112,
    'F2': 113,
    'F3': 114,
    'F4': 115,
    'F5': 116,
    'F6': 117,
    'F7': 118,
    'F8': 119,
    'F9': 120,
    'F10': 121,
    'F11': 122,
    'F12': 123,
    'EQUAL': 187,
    'COMMA': 188,
    'SLASH': 191,
    'BACKSLASH': 220
};

/**
 * Un objeto que almacena alias de clave obsoletos, que todavía admitimos pero
 * debe asignarse a alias válidos y generar advertencias.
 *
 * @private
 * @property KEY_DEPRECATIONS
 * @type {Object}
 */
p5.prototype.KEY_DEPRECATIONS = {
  'MINUT': 'MINUS',
  'COMA': 'COMMA'
};

/**
 * Dado un alias de clave de cadena (como se define en la propiedad KEY anterior), busca
 * y devuelve el código de clave JavaScript numérico para esa clave. Si un alias obsoleto
 * se pasa (como se define en la propiedad KEY_DEPRECATIONS) será
 * asignado a un código de clave válido, pero también generará una advertencia sobre el uso
 * del alias obsoleto.
 *
 * @private
 * @method _keyCodeFromAlias
 * @param {!string} alias - un alias de clave que no distingue entre mayúsculas y minúsculas
 * @return {number|undefined} un código clave de JavaScript numérico, o indefinido
 *          si no se encuentra ningún código de clave que coincida con el alias dado.
 */
p5.prototype._keyCodeFromAlias = function(alias) {
  alias = alias.toUpperCase();
  if (this.KEY_DEPRECATIONS[alias]) {
    this._warn('Key literal "' + alias + '" is deprecated and may be removed ' +
      'in a future version of p5.play. ' +
      'Please use "' + this.KEY_DEPRECATIONS[alias] + '" instead.');
    alias = this.KEY_DEPRECATIONS[alias];
  }
  return this.KEY[alias];
};

//pre dibujar: detectar keyStates
p5.prototype.readPresses = function() {
  var keyStates = this._p5play.keyStates;
  var mouseStates = this._p5play.mouseStates;

  for (var key in keyStates) {
    if(this.keyIsDown(key)) //si está inactivo
    {
      if(keyStates[key] === KEY_IS_UP)//y estaba activo
        keyStates[key] = KEY_WENT_DOWN;
      else
        keyStates[key] = KEY_IS_DOWN; //ahora simplemente está inactivo
    }
    else //si está activo
    {
      if(keyStates[key] === KEY_IS_DOWN)//y estaba activo
        keyStates[key] = KEY_WENT_UP;
      else
        keyStates[key] = KEY_IS_UP; //ahora simplemente está inactivo
    }
  }

  //ratón
  for (var btn in mouseStates) {

    if(this._mouseButtonIsPressed(btn)) //si está inactivo
    {
      if(mouseStates[btn] === KEY_IS_UP)//y estaba activo
        mouseStates[btn] = KEY_WENT_DOWN;
      else
        mouseStates[btn] = KEY_IS_DOWN; //ahora simplemente está inactivo
    }
    else //si está activo
    {
      if(mouseStates[btn] === KEY_IS_DOWN)//y estaba activo
        mouseStates[btn] = KEY_WENT_UP;
      else
        mouseStates[btn] = KEY_IS_UP; //ahora simplemente está inactivo
    }
  }

};

/**
* Enciende o apaga el quadTree.
* Un quadtree es una estructura de datos que se utiliza para optimizar la detección de colisiones.
* Puede mejorar el rendimiento cuando hay una gran cantidad de Sprites para
* comprobar continuamente y detectar superposiciones.
*
* p5.play creará y actualizará un quadtree automáticamente, sin embargo está
* inactivo por defecto.
*
* @method useQuadTree
* @param {Boolean} usa Pass como verdadero para habilitar, falso para deshabilitar
*/
p5.prototype.useQuadTree = function(use) {

  if(this.quadTree !== undefined)
  {
    if(use === undefined)
      return this.quadTree.active;
    else if(use)
      this.quadTree.active = true;
    else
      this.quadTree.active = false;
  }
  else
    return false;
};

//el quadTree real
defineLazyP5Property('quadTree', function() {
  var quadTree = new Quadtree({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  }, 4);
  quadTree.active = false;
  return quadTree;
});

/*
//delta independiente de la velocidad de cuadros, realmente no funciona
p5.prototype.deltaTime = 1;

var now = Date.now();
var then = Date.now();
var INTERVAL_60 = 0.0166666; //60 fps

function updateDelta() {
then = now;
now = Date.now();
deltaTime = ((now - then) / 1000)/INTERVAL_60; // egundos desde el último cuadro
}
*/

/**
 * Un Sprite es el componente principal de p5.play:
 * un elemento capaz de almacenar imágenes o animaciones con un conjunto de
 * propiedades como posición y visibilidad.
 * Un Sprite puede tener un colisionador que define el área activa para detectar
 * colisiones o superposiciones con otros sprites e interacciones del ratón.
   *
   * Para crear un Sprite, usa
   * {{#crossLink "p5.play/createSprite:method"}}{{/crossLink}}.
   *
   * @class Sprite
   */

// Para obtener detalles sobre por qué estos documentos no están en un bloque de comentarios de YUIDoc, consulta:
//
// https://github.com/molleindustria/p5.play/pull/67
//
// @param {Number} x Coordenada X inicial
// @param {Number} y Coordenada Y inicial
// @param {Number} width Ancho del rectángulo del marcador de posición y del
// colisionador hasta que se establezca una imagen o un nuevo colisionador
// @param {Number} height Altura del rectángulo de marcador de posición y del
// colisionador hasta que se establezca una imagen o un nuevo colisionador
function Sprite(pInst, _x, _y, _w, _h) {
  var pInstBind = createPInstBinder(pInst);

  var createVector = pInstBind('createVector');
  var color = pInstBind('color');
  var print = pInstBind('print');
  var push = pInstBind('push');
  var pop = pInstBind('pop');
  var colorMode = pInstBind('colorMode');
  var tint = pInstBind('tint');
  var lerpColor = pInstBind('lerpColor');
  var noStroke = pInstBind('noStroke');
  var rectMode = pInstBind('rectMode');
  var ellipseMode = pInstBind('ellipseMode');
  var imageMode = pInstBind('imageMode');
  var translate = pInstBind('translate');
  var scale = pInstBind('scale');
  var rotate = pInstBind('rotate');
  var stroke = pInstBind('stroke');
  var strokeWeight = pInstBind('strokeWeight');
  var line = pInstBind('line');
  var noFill = pInstBind('noFill');
  var fill = pInstBind('fill');
  var textAlign = pInstBind('textAlign');
  var textSize = pInstBind('textSize');
  var text = pInstBind('text');
  var rect = pInstBind('rect');
  var cos = pInstBind('cos');
  var sin = pInstBind('sin');
  var atan2 = pInstBind('atan2');

  var quadTree = pInst.quadTree;
  var camera = pInst.camera;


  // Estas son constantes p5 a las que nos gustaría acceder fácilmente.
  var RGB = p5.prototype.RGB;
  var CENTER = p5.prototype.CENTER;
  var LEFT = p5.prototype.LEFT;
  var BOTTOM = p5.prototype.BOTTOM;

  /**
  * La posición del sprite del sprite como vector (x, y).
  * @property position
  * @type {p5.Vector}
  */
  this.position = createVector(_x, _y);

  /**
  * La posición del sprite al comienzo de la última actualización como vector (x, y).
  * @property previousPosition
  * @type {p5.Vector}
  */
  this.previousPosition = createVector(_x, _y);

  /*
   La posición del sprite al final de la última actualización como vector (x, y).
   Nota: esto diferirá de la posición siempre que se cambie la posición
   directamente por cesión.
  */
  this.newPosition = createVector(_x, _y);

  //Posicionar el desplazamiento en la coordenada x desde la última actualización
  this.deltaX = 0;
  this.deltaY = 0;

  /**
  * La velocidad del sprite como vector (x, y)
  * La velocidad es la velocidad desglosada en sus componentes vertical y horizontal.
  *
  * @property velocity
  * @type {p5.Vector}
  */
  this.velocity = createVector(0, 0);

  /**
  * Establecer un límite a la velocidad escalar del sprite independientemente de la dirección.
  * El valor solo puede ser positivo. Si se establece en -1, no hay límite.
  *
  * @property maxSpeed
  * @type {Number}
  * @default -1
  */
  this.maxSpeed = -1;

  /**
  * Factor de fricción, reduce la velocidad del sprite.
  * La fricción debe estar cerca de 0 (por ejemplo, 0.01)
  * 0: sin fricción
  * 1: fricción total
  *
  * @property friction
  * @type {Number}
  * @default 0
  */
  this.friction = 0;

  /**
  * El colisionador actual del sprite.
  * Puede ser un cuadro delimitador alineado con el eje (un rectángulo no girado)
  * o un colisionador circular.
  * Si el sprite está marcado por colisión, rebote, superposición o eventos del ratón,
  * el colisionador se crea automáticamente a partir de la anchura y la altura   * del sprite o de la dimensión de la imagen en el caso de sprites animados
  *
  * Puedes configurar un colisionador personalizado con Sprite.setCollider
  *
  * @property collider
  * @type {Object}
  */
  this.collider = undefined;

  /**
  * EL objeto que contiene información sobre la colisión / superposición más reciente
  * Para ser usado típicamente en combinación con funciones Sprite.overlap o Sprite.collide
  * Las propiedades son touching.left, touching.right, touching.top,
  * touching.bottom y son verdaderas o falsas según el lado de la
  * colisionador.
  *
  * @property touching
  * @type {Object}
  */
  this.touching = {};
  this.touching.left = false;
  this.touching.right = false;
  this.touching.top = false;
  this.touching.bottom = false;

  /**
  * La masa determina la transferencia de velocidad cuando los sprites rebotan
  * unos contra otros. See Sprite.bounce
  * Cuanto mayor sea la masa, menos se verá afectado el sprite por las colisiones.
  *
  * @property mass
  * @type {Number}
  * @default 1
  */
  this.mass = 1;

  /**
  * Si se establece en verdadero, el sprite no rebotará ni será desplazado por colisiones
  * Simula una masa infinita o un objeto anclado.
  *
  * @property immovable
  * @type {Boolean}
  * @default false
  */
  this.immovable = false;

  //Coeficiente de restitución - velocidad perdida en el rebote
  //0 perfectamente inelástico, 1 elástico,> 1 hiperelástico

  /**
  * Coeficiente de restitución. La velocidad se pierde después de rebotar.
  * 1: perfectamente elástico, no se pierde energía
  * 0: perfectamente inelástico, sin rebotes
  * menos de 1: inelástico, este es el más común en la naturaleza
  * mayor que 1: hiper elástico, la energía aumenta como en un parachoques de pinball
  *
  * @property restitution
  * @type {Number}
  * @default 1
  */
  this.restitution = 1;

  /**
  * Rotación en grados del elemento visual (imagen o animación)
  * Nota: esta no es la dirección del movimiento, consulta getDirection.
  *
  * @property rotation
  * @type {Number}
  * @default 0
  */
  Object.defineProperty(this, 'rotation', {
    enumerable: true,
    get: function() {
      return this._rotation;
    },
    set: function(value) {
      this._rotation = value;
      if (this.rotateToDirection) {
        this.setSpeed(this.getSpeed(), value);
      }
    }
  });

  /**
  * Variable de rotación interna (expresada en grados).
  * Nota: los llamadores externos acceden a esto a través de la propiedad de rotación anterior.
  *
  * @private
  * @property _rotation
  * @type {Number}
  * @default 0
  */
  this._rotation = 0;

  /**
  * Cambio de rotación en grados por fotograma del elemento visual (imagen o animación)
  * Nota: esta no es la dirección del movimiento, consulta getDirection.
  *
  * @property rotationSpeed
  * @type {Number}
  * @default 0
  */
  this.rotationSpeed = 0;


  /**
  * Bloquea automáticamente la propiedad de rotación del elemento visual
  * (imagen o animación) a la dirección de movimiento del objeto y viceversa.
  *
  * @property rotateToDirection
  * @type {Boolean}
  * @default false
  */
  this.rotateToDirection = false;


  /**
  * Determina el orden de renderizado dentro de un grupo: un sprite con
  * la profundidad más baja aparecerá debajo de las de mayor profundidad.
  *
  * Nota: dibujar un grupo antes que otro con drawSprites hará
  * sus miembros aparecen debajo del segundo, como dibujar en el 
  * lienzo p5 normal.
  *
  * @property depth
  * @type {Number}
  * @default Uno más que la mayor profundidad de sprite existente, al llamar
  *          createSprite().  Al llamar a un nuevo Sprite() directamente, la profundidad se
  *          iniciará en 0 (no recomendado).
  */
  this.depth = 0;

  /**
  * Determina la escala del sprite.
  * Ejemplo: 2 será el doble del tamaño nativo de las imágenes,
  * 0.5 será la mitad. La ampliación puede hacer que las imágenes se vean borrosas.
  *
  * @property scale
  * @type {Number}
  * @default 1
  */
  this.scale = 1;

  var dirX = 1;
  var dirY = 1;

  /**
  * La visibilidad del sprite.
  *
  * @property visible
  * @type {Boolean}
  * @default true
  */
  this.visible = true;

  /**
  * Si se establece en true (verdadero), el sprite rastreará el estado del ratón.
  * Se actualizarán las propiedades mouseIsPressed y mouseIsOver.
  * Nota: se establece automáticamente en verdadero si las funciones
  * Se establecen onMouseReleased or onMousePressed.
  *
  * @property mouseActive
  * @type {Boolean}
  * @default false
  */
  this.mouseActive = false;

  /**
  * Verdadero si el ratón está en el colisionador de sprites.
  * Solo lectura.
  *
  * @property mouseIsOver
  * @type {Boolean}
  */
  this.mouseIsOver = false;

  /**
  * Verdadero si se presiona el mouse sobre el colisionador del sprite.
  * Solo lectura.
  *
  * @property mouseIsPressed
  * @type {Boolean}
  */
  this.mouseIsPressed = false;

  /*
  * Ancho de la imagen actual del sprite.
  * Si no se establecen imágenes o animaciones, es el ancho del
  * rectángulo de marcador de posición.
  * Se usa internamente para hacer cálculos y dibujar el sprite.
  *
  * @private
  * @property _internalWidth
  * @type {Number}
  * @default 100
  */
  this._internalWidth = _w;

  /*
  * Altura de la imagen actual del sprite.
  * Si no se establecen imágenes o animaciones, es la altura del
  * rectángulo de marcador de posición.
  * Se usa internamente para hacer cálculos y dibujar el sprite.
  *
  * @private
  * @property _internalHeight
  * @type {Number}
  * @default 100
  */
  this._internalHeight = _h;

  /*
   * @type {number}
   * @private
   * _horizontalStretch es el valor para escalar los sprites de animación en la dirección X
   */
  this._horizontalStretch = 1;

  /*
   * @type {number}
   * @private
   * _verticalStretch s el valor para escalar los sprites de animación en la dirección Y
   */
  this._verticalStretch = 1;

  /*
   * _internalWidth e _internalHeight se utilizan para todos los p5.play
   * cálculos, pero se pueden ampliar el ancho y el alto. Por ejemplo,
   * es posible que desees que los usuarios obtengan y establezcan siempre un ancho escalado:
      Object.defineProperty(this, 'width', {
        enumerable: true,
        configurable: true,
        get: function() {
          return this._internalWidth * this.scale;
        },
        set: function(value) {
          this._internalWidth = value / this.scale;
        }
      });
   */

  /**
  * Ancho de la imagen actual del sprite.
  * Si no se establecen imágenes o animaciones, es el ancho del
  * rectángulo de marcador de posición.
  *
  * @property width
  * @type {Number}
  * @default 100
  */
  Object.defineProperty(this, 'width', {
    enumerable: true,
    configurable: true,
    get: function() {
      if (this._internalWidth === undefined) {
        return 100;
      } else if (this.animation && pInst._fixedSpriteAnimationFrameSizes) {
        return this._internalWidth * this._horizontalStretch;
      } else {
        return this._internalWidth;
      }
    },
    set: function(value) {
      if (this.animation && pInst._fixedSpriteAnimationFrameSizes) {
        this._horizontalStretch = value / this._internalWidth;
      } else {
        this._internalWidth = value;
      }
    }
  });

  if(_w === undefined)
    this.width = 100;
  else
    this.width = _w;

  /**
  * Altura de la imagen actual del sprite.
  * Si no se establecen imágenes o animaciones, es la altura del
  * rectángulo de marcador de posición.
  *
  * @property height
  * @type {Number}
  * @default 100
  */
  Object.defineProperty(this, 'height', {
    enumerable: true,
    configurable: true,
    get: function() {
      if (this._internalHeight === undefined) {
        return 100;
      } else if (this.animation && pInst._fixedSpriteAnimationFrameSizes) {
        return this._internalHeight * this._verticalStretch;
      } else {
        return this._internalHeight;
      }
    },
    set: function(value) {
      if (this.animation && pInst._fixedSpriteAnimationFrameSizes) {
        this._verticalStretch = value / this._internalHeight;
      } else {
        this._internalHeight = value;
      }
    }
  });

  if(_h === undefined)
    this.height = 100;
  else
    this.height = _h;

  /**
  * Ancho sin escala del sprite
  * Si no se establecen imágenes o animaciones, es el ancho del
  * rectángulo de marcador de posición.
  *
  * @property originalWidth
  * @type {Number}
  * @default 100
  */
  this.originalWidth = this._internalWidth;

  /**
  * Altura sin escala del sprite
  * Si no se establecen imágenes o animaciones, es la altura del
  * rectángulo de marcador de posición.
  *
  * @property originalHeight
  * @type {Number}
  * @default 100
  */
  this.originalHeight = this._internalHeight;

  /**
   * Obtiene el ancho escalado del sprite.
   *
   * @method getScaledWidth
   * @return {Number} Scaled width
   */
  this.getScaledWidth = function() {
    return this.width * this.scale;
  };

  /**
   * Obtiene la altura escalada del sprite.
   *
   * @method getScaledHeight
   * @return {Number} Scaled height
   */
  this.getScaledHeight = function() {
    return this.height * this.scale;
  };

  /**
  * Verdadero si se ha eliminado el objeto.
  *
  * @property removed
  * @type {Boolean}
  */
  this.removed = false;

  /**
  * Ciclos antes de la auto remoción.
  * Configúralo para iniciar una cuenta regresiva, cada ciclo de dibujo la propiedad es
  * reducida en 1 unidad. En 0 llamará a sprite.remove()
  * Desactivado si se establece en -1.
  *
  * @property life
  * @type {Number}
  * @default -1
  */
  this.life = -1;

  /**
  * Si se establece en verdadero, dibuja un contorno del colisionador, la profundidad y el centro.
  *
  * @property debug
  * @type {Boolean}
  * @default false
  */
  this.debug = false;

  /**
  * Si no se establecen imágenes o animaciones, este es el color del
  * rectángulo de marcador de posición
  *
  * @property shapeColor
  * @type {color}
  */
  this.shapeColor = color(127, 127, 127);

  /**
  * Grupos a los que pertenece el sprite, incluidos todos los Sprites
  *
  * @property groups
  * @type {Array}
  */
  this.groups = [];

  var animations = {};

  //La etiqueta de la animación actual.
  var currentAnimation = '';

  /**
  * Referencia a la animación actual.
  *
  * @property animation
  * @type {Animation}
  */
  this.animation = undefined;

  /**
   * Colisionador de barrido orientado a lo largo del vector de velocidad actual, que se extiende a
   * cubre las posiciones antiguas y nuevas del sprite.
   *
   * Las esquinas del colisionador barrido se extenderán más allá del barrido de la forma
   * real, pero debería ser suficiente para la detección de colisión de candidatos 
   * de fase amplia.
   *
   * Ten en cuenta que este colisionador no tendrá dimensiones si el sprite de origen no tiene
   * velocidad.
   */
  this._sweptCollider = undefined;

  /**
  * Sprite posición x  (alias de position.x).
  *
  * @property x
  * @type {Number}
  */
  Object.defineProperty(this, 'x', {
    enumerable: true,
    get: function() {
      return this.position.x;
    },
    set: function(value) {
      this.position.x = value;
    }
  });

  /**
  * Sprite posición y (alias de position.y).
  *
  * @property y
  * @type {Number}
  */
  Object.defineProperty(this, 'y', {
    enumerable: true,
    get: function() {
      return this.position.y;
    },
    set: function(value) {
      this.position.y = value;
    }
  });

  /**
  * Sprite velocidad x (alias de velocity.x).
  *
  * @property velocityX
  * @type {Number}
  */
  Object.defineProperty(this, 'velocityX', {
    enumerable: true,
    get: function() {
      return this.velocity.x;
    },
    set: function(value) {
      this.velocity.x = value;
    }
  });

  /**
  * Sprite velocidad y (alias de velocity.y).
  *
  * @property velocityY
  * @type {Number}
  */
  Object.defineProperty(this, 'velocityY', {
    enumerable: true,
    get: function() {
      return this.velocity.y;
    },
    set: function(value) {
      this.velocity.y = value;
    }
  });

  /**
  * Sprite tiempo de vida (alias de vida).
  *
  * @property lifetime
  * @type {Number}
  */
  Object.defineProperty(this, 'lifetime', {
    enumerable: true,
    get: function() {
      return this.life;
    },
    set: function(value) {
      this.life = value;
    }
  });

  /**
  * Sprite rebote (alias de restitución).
  *
  * @property bounciness
  * @type {Number}
  */
  Object.defineProperty(this, 'bounciness', {
    enumerable: true,
    get: function() {
      return this.restitution;
    },
    set: function(value) {
      this.restitution = value;
    }
  });

  /**
  * Retraso del cuadro de animación del Sprite (alias de animation.frameDelay).
  *
  * @property frameDelay
  * @type {Number}
  */
  Object.defineProperty(this, 'frameDelay', {
    enumerable: true,
    get: function() {
      return this.animation && this.animation.frameDelay;
    },
    set: function(value) {
      if (this.animation) {
        this.animation.frameDelay = value;
      }
    }
  });

  /**
   * Si el objeto se está moviendo, usa el colisionador de barrido. De lo contrario, utiliza el
   * colisionador.
   */
  this._getBroadPhaseCollider = function() {
    return (this.velocity.magSq() > 0) ? this._sweptCollider : this.collider;
  };

  /**
   * Devuelve verdadero si los dos sprites se cruzaron en el marco actual,
   * indicando una posible colisión.
   */
  this._doSweptCollidersOverlap = function(target) {
    var displacement = this._getBroadPhaseCollider().collide(target._getBroadPhaseCollider());
    return displacement.x !== 0 || displacement.y !== 0;
  };

  /*
   * @private
   * Manten las propiedades de la animación sincronizadas con la forma en que cambia la animación.
   */
  this._syncAnimationSizes = function(animations, currentAnimation) {
    if (pInst._fixedSpriteAnimationFrameSizes) {
      return;
    }
    if(animations[currentAnimation].frameChanged || this.width === undefined || this.height === undefined)
    {
      this._internalWidth = animations[currentAnimation].getWidth()*abs(this._getScaleX());
      this._internalHeight = animations[currentAnimation].getHeight()*abs(this._getScaleY());
    }
  };

  /**
  * Actualiza el sprite.
  * Llamado automáticamente al comienzo del ciclo de dibujo.
  *
  * @method update
  */
  this.update = function() {

    if(!this.removed)
    {
      if (this._sweptCollider && this.velocity.magSq() > 0) {
        this._sweptCollider.updateSweptColliderFromSprite(this);
      }

      //si ha habido un cambio en algún lugar después de la última actualización
      //la posición anterior es la última posición registrada en la actualización 
      if(this.newPosition !== this.position)
        this.previousPosition = createVector(this.newPosition.x, this.newPosition.y);
      else
        this.previousPosition = createVector(this.position.x, this.position.y);

      this.velocity.x *= 1 - this.friction;
      this.velocity.y *= 1 - this.friction;

      if(this.maxSpeed !== -1)
        this.limitSpeed(this.maxSpeed);

      if(this.rotateToDirection && this.velocity.mag() > 0)
        this._rotation = this.getDirection();

      this.rotation += this.rotationSpeed;

      this.position.x += this.velocity.x;
      this.position.y += this.velocity.y;

      this.newPosition = createVector(this.position.x, this.position.y);

      this.deltaX = this.position.x - this.previousPosition.x;
      this.deltaY = this.position.y - this.previousPosition.y;

      //si hay una animación
      if(animations[currentAnimation])
      {
        //update it
        animations[currentAnimation].update();

        this._syncAnimationSizes(animations, currentAnimation);
      }

      //se crea un colisionador manualmente con setCollider o
      //cuando reviso este sprite para ver si hay colisiones o superposiciones
      if (this.collider) {
        this.collider.updateFromSprite(this);
      }

      //acciones del ratón
      if (this.mouseActive)
      {
        //si ningún colisionador lo configura
          if(!this.collider)
            this.setDefaultCollider();

        this.mouseUpdate();
      }
      else
      {
        if (typeof(this.onMouseOver) === 'function' ||
            typeof(this.onMouseOut) === 'function' ||
            typeof(this.onMousePressed) === 'function' ||
            typeof(this.onMouseReleased) === 'function')
        {
          //si se establece una función del ratón
          //está implícito que queremos que el ratónesté activo, así que
          //hacemos esto automáticamente
          this.mouseActive = true;

          //si ningún colisionador lo configura
          if(!this.collider)
            this.setDefaultCollider();

          this.mouseUpdate();
        }
      }

      //cuenta regresiva de autodestrucción
      if (this.life>0)
        this.life--;
      if (this.life === 0)
        this.remove();
    }
  };//finaliza la actualización

  /**
   * Crea un colisionador predeterminado que coincide con el tamaño del
   * rectángulo de marcador de posición o el cuadro delimitador de la imagen.
   *
   * @method setDefaultCollider
   */
  this.setDefaultCollider = function() {
    if(animations[currentAnimation] && animations[currentAnimation].getWidth() === 1 && animations[currentAnimation].getHeight() === 1) {
      //la animación todavía se está cargando
      return;
    }
    this.setCollider('rectangle');
  };

  /**
   * Actualiza los estados del sprite del mouse y activa los eventos del mouse:
   * onMouseOver, onMouseOut, onMousePressed, onMouseReleased
   *
   * @method mouseUpdate
   */
  this.mouseUpdate = function() {
    var mouseWasOver = this.mouseIsOver;
    var mouseWasPressed = this.mouseIsPressed;

    this.mouseIsOver = false;
    this.mouseIsPressed = false;

    //dar la vuelta
    if(this.collider) {
      var mousePosition;

      if(camera.active)
        mousePosition = createVector(camera.mouseX, camera.mouseY);
      else
        mousePosition = createVector(pInst.mouseX, pInst.mouseY);

      this.mouseIsOver = this.collider.overlap(new p5.PointCollider(mousePosition));

      //variable global p5
      if(this.mouseIsOver && (pInst.mouseIsPressed || pInst.touchIsDown))
        this.mouseIsPressed = true;

      //cambio de evento - funciones de llamada
      if(!mouseWasOver && this.mouseIsOver && this.onMouseOver !== undefined)
        if(typeof(this.onMouseOver) === 'function')
          this.onMouseOver.call(this, this);
        else
          print('Warning: onMouseOver should be a function');

      if(mouseWasOver && !this.mouseIsOver && this.onMouseOut !== undefined)
        if(typeof(this.onMouseOut) === 'function')
          this.onMouseOut.call(this, this);
        else
          print('Warning: onMouseOut should be a function');

      if(!mouseWasPressed && this.mouseIsPressed && this.onMousePressed !== undefined)
        if(typeof(this.onMousePressed) === 'function')
          this.onMousePressed.call(this, this);
        else
          print('Warning: onMousePressed should be a function');

      if(mouseWasPressed && !pInst.mouseIsPressed && !this.mouseIsPressed && this.onMouseReleased !== undefined)
        if(typeof(this.onMouseReleased) === 'function')
          this.onMouseReleased.call(this, this);
        else
          print('Warning: onMouseReleased should be a function');

    }
  };

  /**
  * Establece un colisionador para el sprite.
  *
  * En p5.play, un Collider (Colisionador) es un círculo o rectángulo invisible
  * que puede tener cualquier tamaño o posición en relación con el objeto y que
  * se utilizará para detectar colisiones y superposición con otros sprites,
  * o el cursor del ratón.
  *
  * Si el sprite está marcado por colisión, rebote, superposición o eventos de ratón
  * se crea automáticamente un colisionador de rectángulos a partir de los parámetros
  * ancho y alto que pasan en la creación del sprite o desde la dimensión 
  * de la imagen en caso de sprites animados.
  *
  * A menudo, el cuadro delimitador de la imagen no es apropiado como área activa para
  * detección de colisiones para que pueda configurar un sprite circular o rectangular con
  * diferentes dimensiones y desplazamiento del centro del sprite.
  *
  * Hay muchas formas de llamar a este método. El primer argumento determina el
  * tipo de colisionador que estás creando, que a su vez cambia el resto de
  * argumentos. Los tipos de colisionadores válidos son:
  *
  * * `point` - un colisionador de puntos sin dimensiones, solo una posición.
  *
  *   `setCollider("point"[, offsetX, offsetY])`
  *
  * * `circle` - un colisionador circular con un radio establecido.
  *
  *   `setCollider("circle"[, offsetX, offsetY[, radius])`
  *
  * * `rectangle` - un alias para` aabb`, a continuación.
  *
  * * `aabb` - Un cuadro delimitador alineado con el eje - tiene ancho y alto pero no rotación.
  *
  *   `setCollider("aabb"[, offsetX, offsetY[, width, height]])`
  *
  * * `obb` - Un cuadro delimitador orientado - tiene ancho, alto y rotación.
  *
  *   `setCollider("obb"[, offsetX, offsetY[, width, height[, rotation]]])`
  *
  *
  * @method setCollider
  * @param {String} type One of "point", "circle", "rectangle", "aabb" or "obb"
  * @param {Number} [offsetX] Posición x del colisionador desde el centro del sprite
  * @param {Number} [offsetY] Posición y del colisionador desde el centro del sprite
  * @param {Number} [width] Ancho o radio del colisionador
  * @param {Number} [height] Altura del colisionador
  * @param {Number} [rotation] Rotación del colisionador en grados
  * @throws {TypeError} si se proporcionan parámetros no válidos.
  */
  this.setCollider = function(type, offsetX, offsetY, width, height, rotation) {
    var _type = type ? type.toLowerCase() : '';
    if (_type === 'rectangle') {
      // Asigna 'rectángulo' a AABB. Cambia esto si quierea que sea OBB por defecto.
      _type = 'obb';
    }

    // Verifica los argumentos correctos, proporciona un mensaje de uso sensible al contexto si es incorrecto.
    if (!(_type === 'point' || _type === 'circle' || _type === 'obb' || _type === 'aabb')) {
      throw new TypeError('setCollider expects the first argument to be one of "point", "circle", "rectangle", "aabb" or "obb"');
    } else if (_type === 'point' && !(arguments.length === 1 || arguments.length === 3)) {
      throw new TypeError('Usage: setCollider("' + type + '"[, offsetX, offsetY])');
    } else if (_type === 'circle' && !(arguments.length === 1 || arguments.length === 3 || arguments.length === 4)) {
      throw new TypeError('Usage: setCollider("' + type + '"[, offsetX, offsetY[, radius]])');
    } else if (_type === 'aabb' && !(arguments.length === 1 || arguments.length === 3 || arguments.length === 5)) {
      throw new TypeError('Usage: setCollider("' + type + '"[, offsetX, offsetY[, width, height]])');
    } else if (_type === 'obb' && !(arguments.length === 1 || arguments.length === 3 || arguments.length === 5 || arguments.length === 6)) {
      throw new TypeError('Usage: setCollider("' + type + '"[, offsetX, offsetY[, width, height[, rotation]]])');
    }

    //var center = this.position;
    var offset = createVector(offsetX, offsetY);

    if (_type === 'point') {
      this.collider = p5.PointCollider.createFromSprite(this, offset);
    } else if (_type === 'circle') {
      this.collider = p5.CircleCollider.createFromSprite(this, offset, width);
    } else if (_type === 'aabb') {
      this.collider = p5.AxisAlignedBoundingBoxCollider.createFromSprite(this, offset, width, height);
    } else if (_type === 'obb') {
      this.collider = p5.OrientedBoundingBoxCollider.createFromSprite(this, offset, width, height, radians(rotation));
    }

    this._sweptCollider = new p5.OrientedBoundingBoxCollider();

    // Deshabilitado para Code.org, ya que perf parece mejor sin el quadtree:
    // quadTree.insert(this);
  };

  /**
  * Establece el reflejo horizontal del objeto..
  * Si 1 las imágenes se muestran normalmente
  * Si -1 las imágenes se voltean horizontalmente
  * Si ningún argumento devuelve el reflejo x actual
  *
  * @method mirrorX
  * @param {Number} dir 1 o -1
  * @return {Number} uplicación actual si no se especifica ningún parámetro
  */
  this.mirrorX = function(dir) {
    if(dir === 1 || dir === -1)
      dirX = dir;
    else
      return dirX;
  };

  /**
   * Establece el reflejo vertical del objeto.
   * Si 1 las imágenes se muestran normalmente
   * Si -1 las imágenes se voltean verticalmente
   * Si ningún argumento devuelve el reflejo y actual
  *
  * @method mirrorY
  * @param {Number} dir 1 o -1
  * @return {Number} Duplicación actual si no se especifica ningún parámetro
  */
  this.mirrorY = function(dir) {
    if(dir === 1 || dir === -1)
      dirY = dir;
    else
      return dirY;
  };

  /*
   * Devuelve el valor que el sprite debe escalar en la dirección X.
   * Se utiliza para calcular el renderizado y las colisiones.
   * Cuando se establece _fixedSpriteAnimationFrameSizes, el valor de escala debe
   * incluir el tramo horizontal para animaciones.
   * @private
   */
  this._getScaleX = function()
  {
    if (pInst._fixedSpriteAnimationFrameSizes) {
      return this.scale * this._horizontalStretch;
    }
    return this.scale;
  };

  /*
   * Devuelve el valor que el sprite debe escalar en la dirección Y.
   * Se utiliza para calcular el renderizado y las colisiones.
   * Cuando se establece _fixedSpriteAnimationFrameSizes, el valor de escala debe
   * incluir el tramo vertical para animaciones.
   * @private
   */
  this._getScaleY = function()
  {
    if (pInst._fixedSpriteAnimationFrameSizes) {
      return this.scale * this._verticalStretch;
    }
    return this.scale;
  };

  /**
   * Maneja el posicionamiento, escala y rotación del sprite
   * Llamado automáticamente, no debe anularse
   * @private
   * @final
   * @method display
   */
  this.display = function()
  {
    if (this.visible && !this.removed)
    {
      push();
      colorMode(RGB);

      noStroke();
      rectMode(CENTER);
      ellipseMode(CENTER);
      imageMode(CENTER);

      translate(this.position.x, this.position.y);
      if (pInst._angleMode === pInst.RADIANS) {
        rotate(radians(this.rotation));
      } else {
        rotate(this.rotation);
      }
      scale(this._getScaleX()*dirX, this._getScaleY()*dirY);
      this.draw();
      //dibujar información de depuración
      pop();


      if(this.debug)
      {
        push();
        //dibuja el punto de anclaje
        stroke(0, 255, 0);
        strokeWeight(1);
        line(this.position.x-10, this.position.y, this.position.x+10, this.position.y);
        line(this.position.x, this.position.y-10, this.position.x, this.position.y+10);
        noFill();

        //número de profundidad
        noStroke();
        fill(0, 255, 0);
        textAlign(LEFT, BOTTOM);
        textSize(16);
        text(this.depth+'', this.position.x+4, this.position.y-2);

        noFill();
        stroke(0, 255, 0);

        // Dibujar forma de colisión
        if (this.collider === undefined) {
          this.setDefaultCollider();
        }
        if(this.collider) {
          this.collider.draw(pInst);
        }
        pop();
      }

    }
  };


  /**
  * Gestiona las imágenes del sprite.
  * Se puede anular con una función de dibujo personalizada.
  * El punto 0,0 será el centro del sprite.
  * Ejemplo::
  * sprite.draw = function() { ellipse(0,0,10,10) }
  * Mostrará el sprite como un círculo
  *
  * @method draw
  */
  this.draw = function()
  {
    if(currentAnimation !== '' && animations)
    {
      if(animations[currentAnimation]) {
        if(this.tint) {
          push();
          tint(this.tint);
        }
        animations[currentAnimation].draw(0, 0, 0);
        if(this.tint) {
          pop();
        }
      }
    }
    else
    {
      var fillColor = this.shapeColor;
      if (this.tint) {
        fillColor = lerpColor(color(fillColor), color(this.tint), 0.5);
      }
      noStroke();
      fill(fillColor);
      rect(0, 0, this._internalWidth, this._internalHeight);
    }
  };

  /**
   * Elimina el Sprite del boceto.
   * El Sprite eliminado ya no se dibujará ni actualizará..
   *
   * @method remove
   */
  this.remove = function() {
    this.removed = true;

    quadTree.removeObject(this);

    //El Sprite eliminado ya no se dibujará ni actualizará.
    while (this.groups.length > 0) {
      this.groups[0].remove(this);
    }
  };

  /**
   * Alias para <a href='#method-remove'>remove()</a>
   *
   * @method destroy
   */
  this.destroy = this.remove;

  /**
  * Establece el vector de velocidad.
  *
  * @method setVelocity
  * @param {Number} x X component
  * @param {Number} y Y component
  */
  this.setVelocity = function(x, y) {
    this.velocity.x = x;
    this.velocity.y = y;
  };

  /**
  * Calcula la velocidad escalar.
  *
  * @method getSpeed
  * @return {Number} Velocidad escalar
  */
  this.getSpeed = function() {
    return this.velocity.mag();
  };

  /**
  * Calcula la dirección del movimiento en grados.
  *
  * @method getDirection
  * @return {Number} Ángulo en grados
  */
  this.getDirection = function() {

    var direction = atan2(this.velocity.y, this.velocity.x);

    if(isNaN(direction))
      direction = 0;

    // A diferencia de Math.atan2, el método atan2 anterior devolverá grados si
    // el p5 angleMode actual es DEGREES, y radianes si el p5 angleMode es
    // RADIANS. Este método siempre debería devolver grados (por ahora).
    // Ver https://github.com/molleindustria/p5.play/issues/94
    if (pInst._angleMode === pInst.RADIANS) {
      direction = degrees(direction);
    }

    return direction;
  };

  /**
  * Agrega el objeto a un grupo existente
  *
  * @method addToGroup
  * @param {Object} group
  */
  this.addToGroup = function(group) {
    if(group instanceof Array)
      group.add(this);
    else
      print('addToGroup error: '+group+' is not a group');
  };

  /**
  * Limita la velocidad escalar.
  *
  * @method limitSpeed
  * @param {Number} max elocidad máxima: número positivo
  */
  this.limitSpeed = function(max) {

    //actualizar la velocidad lineal
    var speed = this.getSpeed();

    if(abs(speed)>max)
    {
      //encontrar el factor de reducción
      var k = max/abs(speed);
      this.velocity.x *= k;
      this.velocity.y *= k;
    }
  };

  /**
  * Establece la velocidad y la dirección del sprite.
  * La acción sobrescribe la velocidad actual.
  * Si no se proporciona la dirección, se mantiene la dirección actual.
  * Si no se proporciona la dirección y no hay velocidad actual, el actual
  * ángulo de rotación utilizado para la dirección.
  *
  * @method setSpeed
  * @param {Number}  speed Velocidad escalar
  * @param {Number}  [angle] Dirección en grados
  */
  this.setSpeed = function(speed, angle) {
    var a;
    if (typeof angle === 'undefined') {
      if (this.velocity.x !== 0 || this.velocity.y !== 0) {
        a = pInst.atan2(this.velocity.y, this.velocity.x);
      } else {
        if (pInst._angleMode === pInst.RADIANS) {
          a = radians(this._rotation);
        } else {
          a = this._rotation;
        }
      }
    } else {
      if (pInst._angleMode === pInst.RADIANS) {
        a = radians(angle);
      } else {
        a = angle;
      }
    }
    this.velocity.x = cos(a)*speed;
    this.velocity.y = sin(a)*speed;
  };

  /**
   * Alias para <a href='#method-setSpeed'>setSpeed()</a>
   *
   * @method setSpeedAndDirection
   * @param {Number}  speed Velocidad escalar
   * @param {Number}  [angle] Dirección en grados
   */
  this.setSpeedAndDirection = this.setSpeed;

  /**
  * Alias para <a href='Animation.html#method-changeFrame'>animation.changeFrame()</a>
  *
  * @method setFrame
  * @param {Number} frame Número de cuadro (comienza desde 0).
  */
  this.setFrame = function(f) {
    if (this.animation) {
      this.animation.changeFrame(f);
    }
  };

  /**
  * Alias para <a href='Animation.html#method-nextFrame'>animation.nextFrame()</a>
  *
  * @method nextFrame
  */
  this.nextFrame = function() {
    if (this.animation) {
      this.animation.nextFrame();
    }
  };

  /**
  * Alias para <a href='Animation.html#method-previousFrame'>animation.previousFrame()</a>
  *
  * @method previousFrame
  */
  this.previousFrame = function() {
    if (this.animation) {
      this.animation.previousFrame();
    }
  };

  /**
  * Alias for <a href='Animation.html#method-stop'>animation.stop()</a>
  *
  * @method pause
  */
  this.pause = function() {
    if (this.animation) {
      this.animation.stop();
    }
  };

  /**
   * Alias para <a href='Animation.html#method-play'>animation.play()</a> with extra logic
   *
   * Reproduce / reanuda la animación actual del sprite.
   * Si la animación se está reproduciendo actualmente, esto no tiene ningún efecto.
   * Si la animación se ha detenido en su último cuadro, ésta volverá a empezar.
   * desde el principio.
   *
   * @method play
   */
  this.play = function() {
    if (!this.animation) {
      return;
    }
    // Normalmente, esto solo establece la bandera de 'reproducción' sin cambiar el cuadro
    // de animación, lo que hará que la animación continúe en la próxima update().
    // Si la animación no se repite y se detiene en el último cuadro
    // también rebobinamos la animación hasta el principio.
    if (!this.animation.looping && !this.animation.playing && this.animation.getFrame() === this.animation.images.length - 1) {
      this.animation.rewind();
    }
    this.animation.play();
  };

  /**
   * Wrapper para acceder a <a href='Animation.html#prop-frameChanged'>animation.frameChanged</a>
   *
   * @method frameDidChange
   * @return {Boolean} verdadero si el marco de la animación ha cambiado
   */
  this.frameDidChange = function() {
    return this.animation ? this.animation.frameChanged : false;
  };

  /**
  * Gira el sprite hacia una posición específica
  *
  * @method setFrame
  * @param {Number} x Coordenada horizontal a la que apuntar
  * @param {Number} y Coordenada vertical a la que apuntar
  */
  this.pointTo = function(x, y) {
    var yDelta = y - this.position.y;
    var xDelta = x - this.position.x;
    if (!isNaN(xDelta) && !isNaN(yDelta) && (xDelta !== 0 || yDelta !== 0)) {
      var radiansAngle = Math.atan2(yDelta, xDelta);
      this.rotation = 360 * radiansAngle / (2 * Math.PI);
    }
  };

  /**
  * Empuja el objeto en una dirección definida por un ángulo.
  * La fuerza se suma a la velocidad actual.
  *
  * @method addSpeed
  * @param {Number}  speed Velocidad escalar para agregar
  * @param {Number}  angle Dirección del ángulo en grados
 * /
  */
  this.addSpeed = function(speed, angle) {
    var a;
    if (pInst._angleMode === pInst.RADIANS) {
      a = radians(angle);
    } else {
      a = angle;
    }
    this.velocity.x += cos(a) * speed;
    this.velocity.y += sin(a) * speed;
  };

  /**
  * Empuja el objeto hacia un punto.
  * La fuerza se suma a la velocidad actual.
  *
  * @method attractionPoint
  * @param {Number}  magnitude Velocidad escalar para agregar
  * @param {Number}  pointX Dirección x coordenada
  * @param {Number}  pointY Dirección y coordenada
  */
  this.attractionPoint = function(magnitude, pointX, pointY) {
    var angle = atan2(pointY-this.position.y, pointX-this.position.x);
    this.velocity.x += cos(angle) * magnitude;
    this.velocity.y += sin(angle) * magnitude;
  };


  /**
  * Agrega una imagen al objeto.
  * Una imagen se considerará una animación de un cuadro.
  * La imagen debe estar precargada en la función preload() usando p5 loadImage.
  * Las animaciones requieren una etiqueta de identificación (string) para cambiarlas.
  * La imagen se almacena en el sprite pero no necesariamente se muestra
  * hasta que se llame a Sprite.changeAnimation(label)
  *
  * Usos:
  * - sprite.addImage(label, image);
  * - sprite.addImage(image);
  *
  * Si solo se pasa una imagen, no se especifica ninguna etiqueta
  *
  * @method addImage
  * @param {String|p5.Image} label Etiqueta o imagen
  * @param {p5.Image} [img] Imagen
  */
  this.addImage = function()
  {
    if(typeof arguments[0] === 'string' && arguments[1] instanceof p5.Image)
      this.addAnimation(arguments[0], arguments[1]);
    else if(arguments[0] instanceof p5.Image)
      this.addAnimation('normal', arguments[0]);
    else
      throw('addImage error: allowed usages are <image> or <label>, <image>');
  };

  /**
  * Agrega una animación al sprite.
  * La animación debe estar precargada en la función preload()
  * usando loadAnimation.
  * Las animaciones requieren una etiqueta de identificación (cadena) para cambiarlas.
  * Las animaciones se almacenan en el sprite pero no necesariamente se muestran
  * hasta que se llame a Sprite.changeAnimation(etiqueta).
  *
  * Uso:
  * - sprite.addAnimation(etiqueta, animación);
  *
  * Usos alternativos. Consulta la  Animación para obtener más información sobre las secuencias de archivos:
  * - sprite.addAnimation(label, firstFrame, lastFrame);
  * - sprite.addAnimation(label, frame1, frame2, frame3...);
  *
  * @method addAnimation
  * @param {String} label Identificador de animación
  * @param {Animation} animation TLa animación precargada
  */
  this.addAnimation = function(label)
  {
    var anim;

    if(typeof label !== 'string')
    {
      print('Sprite.addAnimation error: the first argument must be a label (String)');
      return -1;
    }
    else if(arguments.length < 2)
    {
      print('addAnimation error: you must specify a label and n frame images');
      return -1;
    }
    else if(arguments[1] instanceof Animation)
    {

      var sourceAnimation = arguments[1];

      var newAnimation = sourceAnimation.clone();

      animations[label] = newAnimation;

      if(currentAnimation === '')
      {
        currentAnimation = label;
        this.animation = newAnimation;
      }

      newAnimation.isSpriteAnimation = true;

      this._internalWidth = newAnimation.getWidth()*abs(this._getScaleX());
      this._internalHeight = newAnimation.getHeight()*abs(this._getScaleY());

      return newAnimation;
    }
    else
    {
      var animFrames = [];
      for(var i=1; i<arguments.length; i++)
        animFrames.push(arguments[i]);

      anim = construct(pInst.Animation, animFrames);
      animations[label] = anim;

      if(currentAnimation === '')
      {
        currentAnimation = label;
        this.animation = anim;
      }
      anim.isSpriteAnimation = true;

      this._internalWidth = anim.getWidth()*abs(this._getScaleX());
      this._internalHeight = anim.getHeight()*abs(this._getScaleY());

      return anim;
    }

  };

  /**
  * Cambia la imagen / animación mostrada.
  * Equivalente a changeAnimation
  *
  * @method changeImage
  * @param {String} label Identificador de imagen / animación
  */
  this.changeImage = function(label) {
    this.changeAnimation(label);
  };

   /**
  * Devuelve la etiqueta de la animación actual
  *
  * @method getAnimationLabel
  * @return {String} label identificador de imagen / animación de etiqueta
  */
  this.getAnimationLabel = function() {
    return currentAnimation;
  };

  /**
  * Cambia la animación mostrada.
  * onsulta la Animación para obtener más control sobre la secuencia.
  *
  * @method changeAnimation
  * @param {String} label Identificador de animación
  */
  this.changeAnimation = function(label) {
    if(!animations[label])
      print('changeAnimation error: no animation labeled '+label);
    else
    {
      currentAnimation = label;
      this.animation = animations[label];
    }
  };

  /**
  * Establece la animación de una lista en _predefinedSpriteAnimations.
  *
  * @method setAnimation
  * @private
  * @param {String} label Identificador de animación
  */
  this.setAnimation = function(animationName) {
    if (animationName === this.getAnimationLabel()) {
      return;
    }

    var animation = pInst._predefinedSpriteAnimations &&
        pInst._predefinedSpriteAnimations[animationName];
    if (typeof animation === 'undefined') {
      throw new Error('Unable to find an animation named "' + animationName +
          '".  Please make sure the animation exists.');
    }
    this.addAnimation(animationName, animation);
    this.changeAnimation(animationName);
    if (pInst._pauseSpriteAnimationsByDefault) {
      this.pause();
    }
  };

  /**
  * Comprueba si el punto dado corresponde a un píxel transparente
  * en la imagen actual del sprite. Se puede utilizar para comprobar una colisión puntual
   * solo contra la parte visible del objeto.
  *
  * @method overlapPixel
  * @param {Number} pointX coordenada x del punto a comprobar
  * @param {Number} pointY coordenada y del punto a comprobar
  * @return {Boolean} result Verdadero si no es transparente
  */
  this.overlapPixel = function(pointX, pointY) {
    var point = createVector(pointX, pointY);

    var img = this.animation.getFrameImage();

    //convertir el punto a la posición relativa de img
    point.x -= this.position.x-img.width/2;
    point.y -= this.position.y-img.height/2;

    //fuera de la imagen por completo
    if(point.x<0 || point.x>img.width || point.y<0 || point.y>img.height)
      return false;
    else if(this.rotation === 0 && this.scale === 1)
    {
      //verdadero si la opacidad es total
      var values = img.get(point.x, point.y);
      return values[3] === 255;
    }
    else
    {
      print('Error: overlapPixel doesn\'t work with scaled or rotated sprites yet');
      //impresión fuera de pantalla que se implementará bleurch
      return false;
    }
  };

  /**
  * Comprueba si el punto dado está dentro del colisionador del sprite.
  *
  * @method overlapPoint
  * @param {Number} pointX coordenada x del punto a comprobar
  * @param {Number} pointY coordenada x del punto a comprobar
  * @return {Boolean} result Verdadero si está dentro
  */
  this.overlapPoint = function(pointX, pointY) {
    if(!this.collider)
      this.setDefaultCollider();

    if(this.collider) {
      var point = new p5.PointCollider(new p5.Vector(pointX, pointY));
      return this.collider.overlap(point);
    }
    return false;
  };


  /**
  * Checks if the the sprite is overlapping another sprite or a group.
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the overlap occours.
  * If the target is a group the function will be called for each single
  * sprite overlapping. The parameter of the function are respectively the
  * current sprite and the colliding sprite.
  *
  * @example
  *     sprite.overlap(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method overlap
  * @param {Object} target Sprite or group to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  this.overlap = function(target, callback) {
    return this._collideWith('overlap', target, callback);
  };

  /**
   * Alias for <a href='#method-overlap'>overlap()</a>, except without a
   * callback parameter.
   * The check is performed using the colliders. If colliders are not set
   * they will be created automatically from the image/animation bounding box.
   *
   * Returns whether or not this sprite is overlapping another sprite
   * or group. Modifies the sprite's touching property object.
   *
   * @method isTouching
   * @param {Object} target Sprite or group to check against the current one
   * @return {Boolean} True if touching
   */
  this.isTouching = this.overlap;

  /**
  * Checks if the the sprite is overlapping another sprite or a group.
  * If the overlap is positive the sprite will bounce with the target(s)
  * treated as immovable with a restitution coefficient of zero.
  *
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the collision occours.
  * If the target is a group the function will be called for each single
  * sprite colliding. The parameter of the function are respectively the
  * current sprite and the colliding sprite.
  *
  * @example
  *     sprite.collide(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method collide
  * @param {Object} target Sprite or group to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  this.collide = function(target, callback) {
    return this._collideWith('collide', target, callback);
  };

  /**
  * Checks if the the sprite is overlapping another sprite or a group.
  * If the overlap is positive the current sprite will displace
  * the colliding one to the closest non-overlapping position.
  *
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the collision occours.
  * If the target is a group the function will be called for each single
  * sprite colliding. The parameter of the function are respectively the
  * current sprite and the colliding sprite.
  *
  * @example
  *     sprite.displace(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method displace
  * @param {Object} target Sprite or group to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  this.displace = function(target, callback) {
    return this._collideWith('displace', target, callback);
  };

  /**
  * Checks if the the sprite is overlapping another sprite or a group.
  * If the overlap is positive the sprites will bounce affecting each
  * other's trajectories depending on their .velocity, .mass and .restitution
  *
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the collision occours.
  * If the target is a group the function will be called for each single
  * sprite colliding. The parameter of the function are respectively the
  * current sprite and the colliding sprite.
  *
  * @example
  *     sprite.bounce(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method bounce
  * @param {Object} target Sprite or group to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  this.bounce = function(target, callback) {
    return this._collideWith('bounce', target, callback);
  };

  /**
  * Checks if the the sprite is overlapping another sprite or a group.
  * If the overlap is positive the sprite will bounce with the target(s)
  * treated as immovable.
  *
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the collision occours.
  * If the target is a group the function will be called for each single
  * sprite colliding. The parameter of the function are respectively the
  * current sprite and the colliding sprite.
  *
  * @example
  *     sprite.bounceOff(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method bounceOff
  * @param {Object} target Sprite or group to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  this.bounceOff = function(target, callback) {
    return this._collideWith('bounceOff', target, callback);
  };

  /**
   * Internal collision detection function. Do not use directly.
   *
   * Handles collision with individual sprites or with groups, using the
   * quadtree to optimize the latter.
   *
   * @method _collideWith
   * @private
   * @param {string} type - 'overlap', 'isTouching', 'displace', 'collide',
   *   'bounce' or 'bounceOff'
   * @param {Sprite|Group} target
   * @param {function} callback - if collision occurred (ignored for 'isTouching')
   * @return {boolean} true if a collision occurred
   */
  this._collideWith = function(type, target, callback) {
    this.touching.left = false;
    this.touching.right = false;
    this.touching.top = false;
    this.touching.bottom = false;

    if (this.removed) {
      return false;
    }

    var others = [];

    if (target instanceof Sprite) {
      others.push(target);
    } else if (target instanceof Array) {
      if (pInst.quadTree !== undefined && pInst.quadTree.active) {
        others = pInst.quadTree.retrieveFromGroup(this, target);
      }

      // If the quadtree is disabled -or- no sprites in this group are in the
      // quadtree yet (because their default colliders haven't been created)
      // we should just check all of them.
      if (others.length === 0) {
        others = target;
      }
    } else {
      throw('Error: overlap can only be checked between sprites or groups');
    }

    var result = false;
    for(var i = 0; i < others.length; i++) {
      result = this._collideWithOne(type, others[i], callback) || result;
    }
    return result;
  };

  /**
   * Helper collision method for colliding this sprite with one other sprite.
   *
   * Has the side effect of setting this.touching properties to TRUE if collisions
   * occur.
   *
   * @method _collideWithOne
   * @private
   * @param {string} type - 'overlap', 'isTouching', 'displace', 'collide',
   *   'bounce' or 'bounceOff'
   * @param {Sprite} other
   * @param {function} callback - if collision occurred (ignored for 'isTouching')
   * @return {boolean} true if a collision occurred
   */
  this._collideWithOne = function(type, other, callback) {
    // Never collide with self
    if (other === this || other.removed) {
      return false;
    }

    if (this.collider === undefined) {
      this.setDefaultCollider();
    }

    if (other.collider === undefined) {
      other.setDefaultCollider();
    }

    if (!this.collider || !other.collider) {
      // We were unable to create a collider for one of the sprites.
      // This usually means its animation is not available yet; it will be soon.
      // Don't collide for now.
      return false;
    }

    // Actually compute the overlap of the two colliders
    var displacement = this._findDisplacement(other);
    if (displacement.x === 0 && displacement.y === 0) {
      // These sprites are not overlapping.
      return false;
    }

    if (displacement.x > 0)
      this.touching.left = true;
    if (displacement.x < 0)
      this.touching.right = true;
    if (displacement.y < 0)
      this.touching.bottom = true;
    if (displacement.y > 0)
      this.touching.top = true;

    // Apply displacement out of collision
    if (type === 'displace' && !other.immovable) {
      other.position.sub(displacement);
    } else if ((type === 'collide' || type === 'bounce' || type === 'bounceOff') && !this.immovable) {
      this.position.add(displacement);
      this.previousPosition = createVector(this.position.x, this.position.y);
      this.newPosition = createVector(this.position.x, this.position.y);
      this.collider.updateFromSprite(this);
    }

    // Create special behaviors for certain collision types by temporarily
    // overriding type and sprite properties.
    // See another block near the end of this method that puts them back.
    var originalType = type;
    var originalThisImmovable = this.immovable;
    var originalOtherImmovable = other.immovable;
    var originalOtherRestitution = other.restitution;
    if (originalType === 'collide') {
      type = 'bounce';
      other.immovable = true;
      other.restitution = 0;
    } else if (originalType === 'bounceOff') {
      type = 'bounce';
      other.immovable = true;
    }

    // If this is a 'bounce' collision, determine the new velocities for each sprite
    if (type === 'bounce') {
      // We are concerned only with velocities parallel to the collision normal,
      // so project our sprite velocities onto that normal (captured in the
      // displacement vector) and use these throughout the calculation
      var thisInitialVelocity = p5.Vector.project(this.velocity, displacement);
      var otherInitialVelocity = p5.Vector.project(other.velocity, displacement);

      // We only care about relative mass values, so if one of the sprites
      // is considered 'immovable' treat the _other_ sprite's mass as zero
      // to get the correct results.
      var thisMass = this.mass;
      var otherMass = other.mass;
      if (this.immovable) {
        thisMass = 1;
        otherMass = 0;
      } else if (other.immovable) {
        thisMass = 0;
        otherMass = 1;
      }

      var combinedMass = thisMass + otherMass;
      var coefficientOfRestitution = this.restitution * other.restitution;
      var initialMomentum = p5.Vector.add(
        p5.Vector.mult(thisInitialVelocity, thisMass),
        p5.Vector.mult(otherInitialVelocity, otherMass)
      );
      var thisFinalVelocity = p5.Vector.sub(otherInitialVelocity, thisInitialVelocity)
        .mult(otherMass * coefficientOfRestitution)
        .add(initialMomentum)
        .div(combinedMass);
      var otherFinalVelocity = p5.Vector.sub(thisInitialVelocity, otherInitialVelocity)
        .mult(thisMass * coefficientOfRestitution)
        .add(initialMomentum)
        .div(combinedMass);
      // Remove velocity before and apply velocity after to both members.
      this.velocity.sub(thisInitialVelocity).add(thisFinalVelocity);
      other.velocity.sub(otherInitialVelocity).add(otherFinalVelocity);
    }

    // Restore sprite properties now that velocity changes have been made.
    // See another block before velocity changes that sets these up.
    type = originalType;
    this.immovable = originalThisImmovable;
    other.immovable = originalOtherImmovable;
    other.restitution = originalOtherRestitution;

    // Finally, for all collision types except 'isTouching', call the callback
    // and record that collision occurred.
    if (typeof callback === 'function' && type !== 'isTouching') {
      callback.call(this, this, other);
    }
    return true;
  };

  this._findDisplacement = function(target) {
    // Multisample if tunneling occurs:
    // Do broad-phase detection. Check if the swept colliders overlap.
    // In that case, test interpolations between their last positions and their
    // current positions, and check for tunneling that way.
    // Use multisampling to catch collisions we might otherwise miss.
    if (this._doSweptCollidersOverlap(target)) {
      // Figure out how many samples we should take.
      // We want to limit this so that we don't take an absurd number of samples
      // when objects end up at very high velocities (as happens sometimes in
      // game engines).
      var radiusOnVelocityAxis = Math.max(
        this.collider._getMinRadius(),
        target.collider._getMinRadius());
      var relativeVelocity = p5.Vector.sub(this.velocity, target.velocity).mag();
      var timestep = Math.max(0.015, radiusOnVelocityAxis / relativeVelocity);
      // If the objects are small enough to benefit from multisampling at this
      // relative velocity
      if (timestep < 1) {
        // Move sprites back to previous positions
        // (We jump through some hoops here to avoid creating too many new
        //  vector objects)
        var thisOriginalPosition = this.position.copy();
        var targetOriginalPosition = target.position.copy();
        this.position.set(this.previousPosition);
        target.position.set(target.previousPosition);

        // Scale deltas down to timestep-deltas
        var thisDelta = p5.Vector.sub(thisOriginalPosition, this.previousPosition).mult(timestep);
        var targetDelta = p5.Vector.sub(targetOriginalPosition, target.previousPosition).mult(timestep);

        // Note: We don't have to check the original position, we can assume it's
        // non-colliding (or it would have been handled on the last frame).
        for (var i = timestep; i < 1; i += timestep) {
          // Move the sprites forward by the sub-frame timestep
          this.position.add(thisDelta);
          target.position.add(targetDelta);
          this.collider.updateFromSprite(this);
          target.collider.updateFromSprite(target);

          // Check for collision at the new sub-frame position
          var displacement = this.collider.collide(target.collider);
          if (displacement.x !== 0 || displacement.y !== 0) {
            // These sprites are overlapping - we have a displacement, and a
            // point-in-time for the collision.
            // If either sprite is immovable, it should move back to its final
            // position.  Otherwise, leave the sprites at their interpolated
            // position when the collision occurred.
            if (this.immovable) {
              this.position.set(thisOriginalPosition);
            }

            if (target.immovable) {
              target.position.set(targetOriginalPosition);
            }

            return displacement;
          }
        }

        // If we didn't find a displacement partway through,
        // restore the sprites to their original positions and fall through
        // to do the collision check at their final position.
        this.position.set(thisOriginalPosition);
        target.position.set(targetOriginalPosition);
      }
    }

    // Ensure the colliders are properly updated to match their parent
    // sprites. Maybe someday we won't have to do this, but for now
    // sprites aren't guaranteed to be internally consistent we do a
    // last-minute update to make sure.
    this.collider.updateFromSprite(this);
    target.collider.updateFromSprite(target);

    return this.collider.collide(target.collider);
  };
} //end Sprite class

defineLazyP5Property('Sprite', boundConstructorFactory(Sprite));

/**
   * A camera facilitates scrolling and zooming for scenes extending beyond
   * the canvas. A camera has a position, a zoom factor, and the mouse
   * coordinates relative to the view.
   * The camera is automatically created on the first draw cycle.
   *
   * In p5.js terms the camera wraps the whole drawing cycle in a
   * transformation matrix but it can be disable anytime during the draw
   * cycle for example to draw interface elements in an absolute position.
   *
   * @class Camera
   * @constructor
   * @param {Number} x Initial x coordinate
   * @param {Number} y Initial y coordinate
   * @param {Number} zoom magnification
   **/
function Camera(pInst, x, y, zoom) {
  /**
  * Camera position. Defines the global offset of the sketch.
  *
  * @property position
  * @type {p5.Vector}
  */
  this.position = pInst.createVector(x, y);

  /**
  * Camera x position. Defines the horizontal global offset of the sketch.
  *
  * @property x
  * @type {Number}
  */
  Object.defineProperty(this, 'x', {
    enumerable: true,
    get: function() {
      return this.position.x;
    },
    set: function(value) {
      this.position.x = value;
    }
  });

  /**
  * Camera y position. Defines the horizontal global offset of the sketch.
  *
  * @property y
  * @type {Number}
  */
  Object.defineProperty(this, 'y', {
    enumerable: true,
    get: function() {
      return this.position.y;
    },
    set: function(value) {
      this.position.y = value;
    }
  });

  /**
  * Camera zoom. Defines the global scale of the sketch.
  * A scale of 1 will be the normal size. Setting it to 2 will make everything
  * twice the size. .5 will make everything half size.
  *
  * @property zoom
  * @type {Number}
  */
  this.zoom = zoom;

  /**
  * MouseX translated to the camera view.
  * Offsetting and scaling the canvas will not change the sprites' position
  * nor the mouseX and mouseY variables. Use this property to read the mouse
  * position if the camera moved or zoomed.
  *
  * @property mouseX
  * @type {Number}
  */
  this.mouseX = pInst.mouseX;

  /**
  * MouseY translated to the camera view.
  * Offsetting and scaling the canvas will not change the sprites' position
  * nor the mouseX and mouseY variables. Use this property to read the mouse
  * position if the camera moved or zoomed.
  *
  * @property mouseY
  * @type {Number}
  */
  this.mouseY = pInst.mouseY;

  /**
  * True if the camera is active.
  * Read only property. Use the methods Camera.on() and Camera.off()
  * to enable or disable the camera.
  *
  * @property active
  * @type {Boolean}
  */
  this.active = false;

  /**
  * Check to see if the camera is active.
  * Use the methods Camera.on() and Camera.off()
  * to enable or disable the camera.
  *
  * @method isActive
  * @return {Boolean} true if the camera is active
  */
  this.isActive = function() {
    return this.active;
  };

  /**
  * Activates the camera.
  * The canvas will be drawn according to the camera position and scale until
  * Camera.off() is called
  *
  * @method on
  */
  this.on = function() {
    if(!this.active)
    {
      cameraPush.call(pInst);
      this.active = true;
    }
  };

  /**
  * Deactivates the camera.
  * The canvas will be drawn normally, ignoring the camera's position
  * and scale until Camera.on() is called
  *
  * @method off
  */
  this.off = function() {
    if(this.active)
    {
      cameraPop.call(pInst);
      this.active = false;
    }
  };
} //end camera class

defineLazyP5Property('Camera', boundConstructorFactory(Camera));

//called pre draw by default
function cameraPush() {
  var pInst = this;
  var camera = pInst.camera;

  //awkward but necessary in order to have the camera at the center
  //of the canvas by default
  if(!camera.init && camera.position.x === 0 && camera.position.y === 0)
    {
    camera.position.x=pInst.width/2;
    camera.position.y=pInst.height/2;
    camera.init = true;
    }

  camera.mouseX = pInst.mouseX+camera.position.x-pInst.width/2;
  camera.mouseY = pInst.mouseY+camera.position.y-pInst.height/2;

  if(!camera.active)
  {
    camera.active = true;
    pInst.push();
    pInst.scale(camera.zoom);
    pInst.translate(-camera.position.x+pInst.width/2/camera.zoom, -camera.position.y+pInst.height/2/camera.zoom);
  }
}

//called postdraw by default
function cameraPop() {
  var pInst = this;

  if(pInst.camera.active)
  {
    pInst.pop();
    pInst.camera.active = false;
  }
}




/**
   * In p5.play groups are collections of sprites with similar behavior.
   * For example a group may contain all the sprites in the background
   * or all the sprites that "kill" the player.
   *
   * Groups are "extended" arrays and inherit all their properties
   * e.g. group.length
   *
   * Since groups contain only references, a sprite can be in multiple
   * groups and deleting a group doesn't affect the sprites themselves.
   *
   * Sprite.remove() will also remove the sprite from all the groups
   * it belongs to.
   *
   * @class Group
   * @constructor
   */
function Group() {

  //basically extending the array
  var array = [];

  /**
  * Gets the member at index i.
  *
  * @method get
  * @param {Number} i The index of the object to retrieve
  */
  array.get = function(i) {
    return array[i];
  };

  /**
  * Checks if the group contains a sprite.
  *
  * @method contains
  * @param {Sprite} sprite The sprite to search
  * @return {Number} Index or -1 if not found
  */
  array.contains = function(sprite) {
    return this.indexOf(sprite)>-1;
  };

  /**
   * Same as Group.contains
   * @method indexOf
   */
  array.indexOf = function(item) {
    for (var i = 0, len = array.length; i < len; ++i) {
      if (virtEquals(item, array[i])) {
        return i;
      }
    }
    return -1;
  };

  /**
  * Adds a sprite to the group.
  *
  * @method add
  * @param {Sprite} s The sprite to be added
  */
  array.add = function(s) {
    if(!(s instanceof Sprite)) {
      throw('Error: you can only add sprites to a group');
    }

    if (-1 === this.indexOf(s)) {
      array.push(s);
      s.groups.push(this);
    }
  };

  /**
   * Same as group.length
   * @method size
   */
  array.size = function() {
    return array.length;
  };

  /**
  * Removes all the sprites in the group
  * from the scene.
  *
  * @method removeSprites
  */
  array.removeSprites = function() {
    while (array.length > 0) {
      array[0].remove();
    }
  };

  /**
  * Removes all references to the group.
  * Does not remove the actual sprites.
  *
  * @method clear
  */
  array.clear = function() {
    array.length = 0;
  };

  /**
  * Removes a sprite from the group.
  * Does not remove the actual sprite, only the affiliation (reference).
  *
  * @method remove
  * @param {Sprite} item The sprite to be removed
  * @return {Boolean} True if sprite was found and removed
  */
  array.remove = function(item) {
    if(!(item instanceof Sprite)) {
      throw('Error: you can only remove sprites from a group');
    }

    var i, removed = false;
    for (i = array.length - 1; i >= 0; i--) {
      if (array[i] === item) {
        array.splice(i, 1);
        removed = true;
      }
    }

    if (removed) {
      for (i = item.groups.length - 1; i >= 0; i--) {
        if (item.groups[i] === this) {
          item.groups.splice(i, 1);
        }
      }
    }

    return removed;
  };

  /**
   * Returns a copy of the group as standard array.
   * @method toArray
   */
  array.toArray = function() {
    return array.slice(0);
  };

  /**
  * Returns the highest depth in a group
  *
  * @method maxDepth
  * @return {Number} The depth of the sprite drawn on the top
  */
  array.maxDepth = function() {
    if (array.length === 0) {
      return 0;
    }

    return array.reduce(function(maxDepth, sprite) {
      return Math.max(maxDepth, sprite.depth);
    }, -Infinity);
  };

  /**
  * Returns the lowest depth in a group
  *
  * @method minDepth
  * @return {Number} The depth of the sprite drawn on the bottom
  */
  array.minDepth = function() {
    if (array.length === 0) {
      return 99999;
    }

    return array.reduce(function(minDepth, sprite) {
      return Math.min(minDepth, sprite.depth);
    }, Infinity);
  };

  /**
  * Draws all the sprites in the group.
  *
  * @method draw
  */
  array.draw = function() {

    //sort by depth
    this.sort(function(a, b) {
      return a.depth - b.depth;
    });

    for(var i = 0; i<this.size(); i++)
    {
      this.get(i).display();
    }
  };

  //internal use
  function virtEquals(obj, other) {
    if (obj === null || other === null) {
      return (obj === null) && (other === null);
    }
    if (typeof (obj) === 'string') {
      return obj === other;
    }
    if (typeof(obj) !== 'object') {
      return obj === other;
    }
    if (obj.equals instanceof Function) {
      return obj.equals(other);
    }
    return obj === other;
  }

  /**
   * Collide each member of group against the target using the given collision
   * type.  Return true if any collision occurred.
   * Internal use
   *
   * @private
   * @method _groupCollide
   * @param {!string} type one of 'overlap', 'collide', 'displace', 'bounce' or 'bounceOff'
   * @param {Object} target Group or Sprite
   * @param {Function} [callback] on collision.
   * @return {boolean} True if any collision/overlap occurred
   */
  function _groupCollide(type, target, callback) {
    var didCollide = false;
    for(var i = 0; i<this.size(); i++)
      didCollide = this.get(i)._collideWith(type, target, callback) || didCollide;
    return didCollide;
  }

  /**
  * Checks if the the group is overlapping another group or sprite.
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the overlap occurs.
  * The function will be called for each single sprite overlapping.
  * The parameter of the function are respectively the
  * member of the current group and the other sprite passed as parameter.
  *
  * @example
  *     group.overlap(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method overlap
  * @param {Object} target Group or Sprite to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  array.overlap = _groupCollide.bind(array, 'overlap');

  /**
   * Alias for <a href='#method-overlap'>overlap()</a>
   *
   * Returns whether or not this group will bounce or collide with another sprite
   * or group. Modifies the each sprite's touching property object.
   *
   * @method isTouching
   * @param {Object} target Group or Sprite to check against the current one
   * @return {Boolean} True if touching
   */
  array.isTouching = array.overlap;

  /**
  * Checks if the the group is overlapping another group or sprite.
  * If the overlap is positive the sprites will bounce with the target(s)
  * treated as immovable with a restitution coefficient of zero.
  *
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the overlap occours.
  * The function will be called for each single sprite overlapping.
  * The parameter of the function are respectively the
  * member of the current group and the other sprite passed as parameter.
  *
  * @example
  *     group.collide(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method collide
  * @param {Object} target Group or Sprite to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  array.collide = _groupCollide.bind(array, 'collide');

  /**
  * Checks if the the group is overlapping another group or sprite.
  * If the overlap is positive the sprites in the group will displace
  * the colliding ones to the closest non-overlapping positions.
  *
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the overlap occurs.
  * The function will be called for each single sprite overlapping.
  * The parameter of the function are respectively the
  * member of the current group and the other sprite passed as parameter.
  *
  * @example
  *     group.displace(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method displace
  * @param {Object} target Group or Sprite to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  array.displace = _groupCollide.bind(array, 'displace');

  /**
  * Checks if the the group is overlapping another group or sprite.
  * If the overlap is positive the sprites will bounce affecting each
  * other's trajectories depending on their .velocity, .mass and .restitution.
  *
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the overlap occours.
  * The function will be called for each single sprite overlapping.
  * The parameter of the function are respectively the
  * member of the current group and the other sprite passed as parameter.
  *
  * @example
  *     group.bounce(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method bounce
  * @param {Object} target Group or Sprite to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  array.bounce = _groupCollide.bind(array, 'bounce');

  /**
  * Checks if the the group is overlapping another group or sprite.
  * If the overlap is positive the sprites will bounce with the target(s)
  * treated as immovable.
  *
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the overlap occours.
  * The function will be called for each single sprite overlapping.
  * The parameter of the function are respectively the
  * member of the current group and the other sprite passed as parameter.
  *
  * @example
  *     group.bounceOff(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method bounceOff
  * @param {Object} target Group or Sprite to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  array.bounceOff = _groupCollide.bind(array, 'bounceOff');

  array.setPropertyEach = function(propName, value) {
    for (var i = 0; i < this.length; i++) {
      this[i][propName] = value;
    }
  };

  array.callMethodEach = function(methodName) {
    // Copy all arguments after the first parameter into methodArgs:
    var methodArgs = Array.prototype.slice.call(arguments, 1);
    // Use a copy of the array in case the method modifies the group
    var elements = [].concat(this);
    for (var i = 0; i < elements.length; i++) {
      elements[i][methodName].apply(elements[i], methodArgs);
    }
  };

  array.setDepthEach = array.setPropertyEach.bind(array, 'depth');
  array.setLifetimeEach = array.setPropertyEach.bind(array, 'lifetime');
  array.setRotateToDirectionEach = array.setPropertyEach.bind(array, 'rotateToDirection');
  array.setRotationEach = array.setPropertyEach.bind(array, 'rotation');
  array.setRotationSpeedEach = array.setPropertyEach.bind(array, 'rotationSpeed');
  array.setScaleEach = array.setPropertyEach.bind(array, 'scale');
  array.setColorEach = array.setPropertyEach.bind(array, 'shapeColor');
  array.setTintEach = array.setPropertyEach.bind(array, 'tint');
  array.setVisibleEach = array.setPropertyEach.bind(array, 'visible');
  array.setVelocityXEach = array.setPropertyEach.bind(array, 'velocityX');
  array.setVelocityYEach = array.setPropertyEach.bind(array, 'velocityY');
  array.setHeightEach = array.setPropertyEach.bind(array, 'height');
  array.setWidthEach = array.setPropertyEach.bind(array, 'width');

  array.destroyEach = array.callMethodEach.bind(array, 'destroy');
  array.pointToEach = array.callMethodEach.bind(array, 'pointTo');
  array.setAnimationEach = array.callMethodEach.bind(array, 'setAnimation');
  array.setColliderEach = array.callMethodEach.bind(array, 'setCollider');
  array.setSpeedAndDirectionEach = array.callMethodEach.bind(array, 'setSpeedAndDirection');
  array.setVelocityEach = array.callMethodEach.bind(array, 'setVelocity');
  array.setMirrorXEach = array.callMethodEach.bind(array, 'mirrorX');
  array.setMirrorYEach = array.callMethodEach.bind(array, 'mirrorY');

  return array;
}

p5.prototype.Group = Group;

/**
 * Creates four edge sprites and adds them to a group. Each edge is just outside
 * of the canvas and has a thickness of 100. After calling this function,
 * the following properties are exposed and populated with sprites:
 * leftEdge, rightEdge, topEdge, bottomEdge
 *
 * The 'edges' property is populated with a group containing those four sprites.
 *
 * If this edge sprites have already been created, the function returns the
 * existing edges group immediately.
 *
 * @method createEdgeSprites
 * @return {Group} The edges group
 */
p5.prototype.createEdgeSprites = function() {
  if (this.edges) {
    return this.edges;
  }

  var edgeThickness = 100;

  var width = this._curElement.elt.offsetWidth;
  var height = this._curElement.elt.offsetHeight;

  this.leftEdge = this.createSprite(-edgeThickness / 2, height / 2, edgeThickness, height);
  this.rightEdge = this.createSprite(width + (edgeThickness / 2), height / 2, edgeThickness, height);
  this.topEdge = this.createSprite(width / 2, -edgeThickness / 2, width, edgeThickness);
  this.bottomEdge = this.createSprite(width / 2, height + (edgeThickness / 2), width, edgeThickness);

  this.edges = this.createGroup();
  this.edges.add(this.leftEdge);
  this.edges.add(this.rightEdge);
  this.edges.add(this.topEdge);
  this.edges.add(this.bottomEdge);

  return this.edges;
};

/**
 * An Animation object contains a series of images (p5.Image) that
 * can be displayed sequentially.
 *
 * All files must be png images. You must include the directory from the sketch root,
 * and the extension .png
 *
 * A sprite can have multiple labeled animations, see Sprite.addAnimation
 * and Sprite.changeAnimation, however an animation can be used independently.
 *
 * An animation can be created either by passing a series of file names,
 * no matter how many or by passing the first and the last file name
 * of a numbered sequence.
 * p5.play will try to detect the sequence pattern.
 *
 * For example if the given filenames are
 * "data/file0001.png" and "data/file0005.png" the images
 * "data/file0003.png" and "data/file0004.png" will be loaded as well.
 *
 * @example
 *     var sequenceAnimation;
 *     var glitch;
 *
 *     function preload() {
 *       sequenceAnimation = loadAnimation("data/walking0001.png", "data/walking0005.png");
 *       glitch = loadAnimation("data/dog.png", "data/horse.png", "data/cat.png", "data/snake.png");
 *     }
 *
 *     function setup() {
 *       createCanvas(800, 600);
 *     }
 *
 *     function draw() {
 *       background(0);
 *       animation(sequenceAnimation, 100, 100);
 *       animation(glitch, 200, 100);
 *     }
 *
 * @class Animation
 * @constructor
 * @param {String} fileName1 First file in a sequence OR first image file
 * @param {String} fileName2 Last file in a sequence OR second image file
 * @param {String} [...fileNameN] Any number of image files after the first two
 */
function Animation(pInst) {
  var frameArguments = Array.prototype.slice.call(arguments, 1);
  var i;

  var CENTER = p5.prototype.CENTER;

  /**
  * Array of frames (p5.Image)
  *
  * @property images
  * @type {Array}
  */
  this.images = [];

  var frame = 0;
  var cycles = 0;
  var targetFrame = -1;

  this.offX = 0;
  this.offY = 0;

  /**
  * Delay between frames in number of draw cycles.
  * If set to 4 the framerate of the anymation would be the
  * sketch framerate divided by 4 (60fps = 15fps)
  *
  * @property frameDelay
  * @type {Number}
  * @default 2
  */
  this.frameDelay = 4;

  /**
  * True if the animation is currently playing.
  *
  * @property playing
  * @type {Boolean}
  * @default true
  */
  this.playing = true;

  /**
  * Animation visibility.
  *
  * @property visible
  * @type {Boolean}
  * @default true
  */
  this.visible = true;

  /**
  * If set to false the animation will stop after reaching the last frame
  *
  * @property looping
  * @type {Boolean}
  * @default true
  */
  this.looping = true;

  /**
  * True if frame changed during the last draw cycle
  *
  * @property frameChanged
  * @type {Boolean}
  */
  this.frameChanged = false;

  //is the collider defined manually or defined
  //by the current frame size
  this.imageCollider = false;


  //sequence mode
  if(frameArguments.length === 2 && typeof frameArguments[0] === 'string' && typeof frameArguments[1] === 'string')
  {
    var from = frameArguments[0];
    var to = frameArguments[1];

    //print("sequence mode "+from+" -> "+to);

    //make sure the extensions are fine
    var ext1 = from.substring(from.length-4, from.length);
    if(ext1 !== '.png')
    {
      pInst.print('Animation error: you need to use .png files (filename '+from+')');
      from = -1;
    }

    var ext2 = to.substring(to.length-4, to.length);
    if(ext2 !== '.png')
    {
      pInst.print('Animation error: you need to use .png files (filename '+to+')');
      to = -1;
    }

    //extensions are fine
    if(from !== -1 && to !== -1)
    {
      var digits1 = 0;
      var digits2 = 0;

      //skip extension work backwards to find the numbers
      for (i = from.length-5; i >= 0; i--) {
        if(from.charAt(i) >= '0' && from.charAt(i) <= '9')
          digits1++;
      }

      for (i = to.length-5; i >= 0; i--) {
        if(to.charAt(i) >= '0' && to.charAt(i) <= '9')
          digits2++;
      }

      var prefix1 = from.substring(0, from.length-(4+digits1));
      var prefix2 = to.substring(0, to.length-(4+digits2) );

      // Our numbers likely have leading zeroes, which means that some
      // browsers (e.g., PhantomJS) will interpret them as base 8 (octal)
      // instead of decimal. To fix this, we'll explicity tell parseInt to
      // use a base of 10 (decimal). For more details on this issue, see
      // http://stackoverflow.com/a/8763427/2422398.
      var number1 = parseInt(from.substring(from.length-(4+digits1), from.length-4), 10);
      var number2 = parseInt(to.substring(to.length-(4+digits2), to.length-4), 10);

      //swap if inverted
      if(number2<number1)
      {
        var t = number2;
        number2 = number1;
        number1 = t;
      }

      //two different frames
      if(prefix1 !== prefix2 )
      {
        //print("2 separate images");
        this.images.push(pInst.loadImage(from));
        this.images.push(pInst.loadImage(to));
      }
      //same digits: case img0001, img0002
      else
      {
        var fileName;
        if(digits1 === digits2)
        {

          //load all images
          for (i = number1; i <= number2; i++) {
            // Use nf() to number format 'i' into four digits
            fileName = prefix1 + pInst.nf(i, digits1) + '.png';
            this.images.push(pInst.loadImage(fileName));

          }

        }
        else //case: case img1, img2
        {
          //print("from "+prefix1+" "+number1 +" to "+number2);
          for (i = number1; i <= number2; i++) {
            // Use nf() to number format 'i' into four digits
            fileName = prefix1 + i + '.png';
            this.images.push(pInst.loadImage(fileName));

          }

        }
      }

    }//end no ext error

  }//end sequence mode
  // Sprite sheet mode
  else if (frameArguments.length === 1 && (frameArguments[0] instanceof SpriteSheet))
  {
    this.spriteSheet = frameArguments[0];
    this.images = this.spriteSheet.frames.map( function(f) {
      if (f.spriteSourceSize && f.sourceSize) {
        return Object.assign(f.frame, {
          width: f.frame.w,
          height: f.frame.h,
          sourceX: f.spriteSourceSize.x,
          sourceY: f.spriteSourceSize.y,
          sourceW: f.sourceSize.w,
          sourceH: f.sourceSize.h,
        });
      }
      return f.frame;
    });
  }
  else if(frameArguments.length !== 0)//arbitrary list of images
  {
    //print("Animation arbitrary mode");
    for (i = 0; i < frameArguments.length; i++) {
      //print("loading "+fileNames[i]);
      if(frameArguments[i] instanceof p5.Image)
        this.images.push(frameArguments[i]);
      else
        this.images.push(pInst.loadImage(frameArguments[i]));
    }
  }

  /**
  * Objects are passed by reference so to have different sprites
  * using the same animation you need to clone it.
  *
  * @method clone
  * @return {Animation} A clone of the current animation
  */
  this.clone = function() {
    var myClone = new Animation(pInst); //empty
    myClone.images = [];

    if (this.spriteSheet) {
      myClone.spriteSheet = this.spriteSheet.clone();
    }
    myClone.images = this.images.slice();

    myClone.offX = this.offX;
    myClone.offY = this.offY;
    myClone.frameDelay = this.frameDelay;
    myClone.playing = this.playing;
    myClone.looping = this.looping;

    return myClone;
  };

  /**
   * Draws the animation at coordinate x and y.
   * Updates the frames automatically.
   *
   * @method draw
   * @param {Number} x x coordinate
   * @param {Number} y y coordinate
   * @param {Number} [r=0] rotation
   */
  this.draw = function(x, y, r) {
    this.xpos = x;
    this.ypos = y;
    this.rotation = r || 0;

    if (this.visible)
    {

      //only connection with the sprite class
      //if animation is used independently draw and update are the sam
      if(!this.isSpriteAnimation)
        this.update();

      //this.currentImageMode = g.imageMode;
      pInst.push();
      pInst.imageMode(CENTER);

      var xTranslate = this.xpos;
      var yTranslate = this.ypos;
      var image = this.images[frame];
      var frame_info = this.spriteSheet && image;

      // Adjust translation if we're dealing with a texture packed spritesheet
      // (with sourceW, sourceH, sourceX, sourceY props on our images array)
      if (frame_info) {
        var missingX = (frame_info.sourceW || frame_info.width) - frame_info.width;
        var missingY = (frame_info.sourceH || frame_info.height) - frame_info.height;
        // If the count of missing (transparent) pixels is not equally balanced on
        // the left vs. right or top vs. bottom, we adjust the translation:
        xTranslate += ((frame_info.sourceX || 0) - missingX / 2);
        yTranslate += ((frame_info.sourceY || 0) - missingY / 2);
      }

      pInst.translate(xTranslate, yTranslate);
      if (pInst._angleMode === pInst.RADIANS) {
        pInst.rotate(radians(this.rotation));
      } else {
        pInst.rotate(this.rotation);
      }

      if (frame_info) {
        if (this.spriteSheet.image instanceof Image) {
          pInst.imageElement(this.spriteSheet.image,
            frame_info.x, frame_info.y,
            frame_info.width, frame_info.height,
            this.offX, this.offY,
            frame_info.width, frame_info.height);
        } else {
          pInst.image(this.spriteSheet.image,
            frame_info.x, frame_info.y,
            frame_info.width, frame_info.height,
            this.offX, this.offY,
            frame_info.width, frame_info.height);
          }
      } else if (image) {
        if (image instanceof Image) {
          pInst.imageElement(image, this.offX, this.offY);
        } else {
          pInst.image(image, this.offX, this.offY);
        }
      } else {
        pInst.print('Warning undefined frame '+frame);
        //this.isActive = false;
      }

      pInst.pop();
    }
  };

  //called by draw
  this.update = function() {
    cycles++;
    var previousFrame = frame;
    this.frameChanged = false;


    //go to frame
    if(this.images.length === 1)
    {
      this.playing = false;
      frame = 0;
    }

    if ( this.playing && cycles%this.frameDelay === 0)
    {
      //going to target frame up
      if(targetFrame>frame && targetFrame !== -1)
      {
        frame++;
      }
      //going to taget frame down
      else if(targetFrame<frame && targetFrame !== -1)
      {
        frame--;
      }
      else if(targetFrame === frame && targetFrame !== -1)
      {
        this.playing=false;
      }
      else if (this.looping) //advance frame
      {
        //if next frame is too high
        if (frame>=this.images.length-1)
          frame = 0;
        else
          frame++;
      } else
      {
        //if next frame is too high
        if (frame<this.images.length-1)
          frame++;
        else
          this.playing = false;
      }
    }

    if(previousFrame !== frame)
      this.frameChanged = true;

  };//end update

  /**
  * Plays the animation.
  *
  * @method play
  */
  this.play = function() {
    this.playing = true;
    targetFrame = -1;
  };

  /**
  * Stops the animation.
  *
  * @method stop
  */
  this.stop = function(){
    this.playing = false;
  };

  /**
  * Rewinds the animation to the first frame.
  *
  * @method rewind
  */
  this.rewind = function() {
    frame = 0;
  };

  /**
  * Changes the current frame.
  *
  * @method changeFrame
  * @param {Number} frame Frame number (starts from 0).
  */
  this.changeFrame = function(f) {
    if (f<this.images.length)
      frame = f;
    else
      frame = this.images.length - 1;

    targetFrame = -1;
    //this.playing = false;
  };

  /**
   * Goes to the next frame and stops.
   *
   * @method nextFrame
   */
  this.nextFrame = function() {

    if (frame<this.images.length-1)
      frame = frame+1;
    else if(this.looping)
      frame = 0;

    targetFrame = -1;
    this.playing = false;
  };

  /**
   * Goes to the previous frame and stops.
   *
   * @method previousFrame
   */
  this.previousFrame = function() {

    if (frame>0)
      frame = frame-1;
    else if(this.looping)
      frame = this.images.length-1;

    targetFrame = -1;
    this.playing = false;
  };

  /**
  * Plays the animation forward or backward toward a target frame.
  *
  * @method goToFrame
  * @param {Number} toFrame Frame number destination (starts from 0)
  */
  this.goToFrame = function(toFrame) {
    if(toFrame < 0 || toFrame >= this.images.length) {
      return;
    }

    // targetFrame gets used by the update() method to decide what frame to
    // select next.  When it's not being used it gets set to -1.
    targetFrame = toFrame;

    if(targetFrame !== frame) {
      this.playing = true;
    }
  };

  /**
  * Returns the current frame number.
  *
  * @method getFrame
  * @return {Number} Current frame (starts from 0)
  */
  this.getFrame = function() {
    return frame;
  };

  /**
  * Returns the last frame number.
  *
  * @method getLastFrame
  * @return {Number} Last frame number (starts from 0)
  */
  this.getLastFrame = function() {
    return this.images.length-1;
  };

  /**
  * Returns the current frame image as p5.Image.
  *
  * @method getFrameImage
  * @return {p5.Image} Current frame image
  */
  this.getFrameImage = function() {
    return this.images[frame];
  };

  /**
  * Returns the frame image at the specified frame number.
  *
  * @method getImageAt
  * @param {Number} frame Frame number
  * @return {p5.Image} Frame image
  */
  this.getImageAt = function(f) {
    return this.images[f];
  };

  /**
  * Returns the current frame width in pixels.
  * If there is no image loaded, returns 1.
  *
  * @method getWidth
  * @return {Number} Frame width
  */
  this.getWidth = function() {
    if (this.images[frame]) {
      return this.images[frame].sourceW || this.images[frame].width;
    } else {
      return 1;
    }
  };

  /**
  * Returns the current frame height in pixels.
  * If there is no image loaded, returns 1.
  *
  * @method getHeight
  * @return {Number} Frame height
  */
  this.getHeight = function() {
    if (this.images[frame]) {
      return this.images[frame].sourceH || this.images[frame].height;
    } else {
      return 1;
    }
  };

}

defineLazyP5Property('Animation', boundConstructorFactory(Animation));

/**
 * Represents a sprite sheet and all it's frames.  To be used with Animation,
 * or static drawing single frames.
 *
 *  There are two different ways to load a SpriteSheet
 *
 * 1. Given width, height that will be used for every frame and the
 *    number of frames to cycle through. The sprite sheet must have a
 *    uniform grid with consistent rows and columns.
 *
 * 2. Given an array of frame objects that define the position and
 *    dimensions of each frame.  This is Flexible because you can use
 *    sprite sheets that don't have uniform rows and columns.
 *
 * @example
 *     // Method 1 - Using width, height for each frame and number of frames
 *     explode_sprite_sheet = loadSpriteSheet('assets/explode_sprite_sheet.png', 171, 158, 11);
 *
 *     // Method 2 - Using an array of objects that define each frame
 *     var player_frames = loadJSON('assets/tiles.json');
 *     player_sprite_sheet = loadSpriteSheet('assets/player_spritesheet.png', player_frames);
 *
 * @class SpriteSheet
 * @constructor
 * @param image String image path or p5.Image object
 */
function SpriteSheet(pInst) {
  var spriteSheetArgs = Array.prototype.slice.call(arguments, 1);

  this.image = null;
  this.frames = [];
  this.frame_width = 0;
  this.frame_height = 0;
  this.num_frames = 0;

  /**
   * Generate the frames data for this sprite sheet baesd on user params
   * @private
   * @method _generateSheetFrames
   */
  this._generateSheetFrames = function() {
    var sX = 0, sY = 0;
    for (var i = 0; i < this.num_frames; i++) {
      this.frames.push(
        {
          'name': i,
          'frame': {
            'x': sX,
            'y': sY,
            'width': this.frame_width,
            'height': this.frame_height
          }
        });
      sX += this.frame_width;
      if (sX >= this.image.width) {
        sX = 0;
        sY += this.frame_height;
        if (sY >= this.image.height) {
          sY = 0;
        }
      }
    }
  };

  var shortArgs = spriteSheetArgs.length === 2 || spriteSheetArgs.length === 3;
  var longArgs = spriteSheetArgs.length === 4 || spriteSheetArgs.length === 5;

  if (shortArgs && Array.isArray(spriteSheetArgs[1])) {
    this.frames = spriteSheetArgs[1];
    this.num_frames = this.frames.length;
  } else if (longArgs &&
    (typeof spriteSheetArgs[1] === 'number') &&
    (typeof spriteSheetArgs[2] === 'number') &&
    (typeof spriteSheetArgs[3] === 'number')) {
    this.frame_width = spriteSheetArgs[1];
    this.frame_height = spriteSheetArgs[2];
    this.num_frames = spriteSheetArgs[3];
  }

  if(spriteSheetArgs[0] instanceof p5.Image || spriteSheetArgs[0] instanceof Image) {
    this.image = spriteSheetArgs[0];
    if (longArgs) {
      this._generateSheetFrames();
    }
  } else {
    // When the final argument is present (either the 3rd or the 5th), it indicates
    // whether we should load the URL as an Image element (as opposed to the default
    // behavior, which is to load it as a p5.Image). If that argument is a function,
    // it will be called back once the load succeeds or fails. On success, the Image
    // will be supplied as the only parameter. On failure, null will be supplied.
    var callback;
    if (shortArgs) {
      if (spriteSheetArgs[2]) {
        if (typeof spriteSheetArgs[2] === 'function') {
          callback = spriteSheetArgs[2];
        }
        this.image = pInst.loadImageElement(
          spriteSheetArgs[0],
          function(img) { if (callback) return callback(img); },
          function() { if (callback) return callback(null); }
        );
      } else {
        this.image = pInst.loadImage(spriteSheetArgs[0]);
      }
    } else if (longArgs) {
      var generateSheetFrames = this._generateSheetFrames.bind(this);
      if (spriteSheetArgs[4]) {
        if (typeof spriteSheetArgs[4] === 'function') {
          callback = spriteSheetArgs[4];
        }
        this.image = pInst.loadImageElement(
          spriteSheetArgs[0],
          function(img) {
            generateSheetFrames(img);
            if (callback) return callback(img);
          },
          function() { if (callback) return callback(null); }
        );
      } else {
        this.image = pInst.loadImage(spriteSheetArgs[0], generateSheetFrames);
      }
    }
  }

  /**
   * Draws a specific frame to the canvas.
   * @param frame_name  Can either be a string name, or a numeric index.
   * @param x   x position to draw the frame at
   * @param y   y position to draw the frame at
   * @param [width]   optional width to draw the frame
   * @param [height]  optional height to draw the frame
   * @method drawFrame
   */
  this.drawFrame = function(frame_name, x, y, width, height) {
    var frameToDraw;
    if (typeof frame_name === 'number') {
      frameToDraw = this.frames[frame_name];
    } else {
      for (var i = 0; i < this.frames.length; i++) {
        if (this.frames[i].name === frame_name) {
          frameToDraw = this.frames[i];
          break;
        }
      }
    }
    var frameWidth = frameToDraw.frame.width || frameToDraw.frame.w;
    var frameHeight = frameToDraw.frame.height || frameToDraw.frame.h;
    var dWidth = width || frameWidth;
    var dHeight = height || frameHeight;

    // Adjust how we draw if we're dealing with a texture packed spritesheet
    // (in particular, we treat supplied width and height params as an intention
    //  to scale versus the sourceSize [before packing])
    if (frameToDraw.spriteSourceSize && frameToDraw.sourceSize) {
      var frameSizeScaleX = frameWidth / frameToDraw.sourceSize.w;
      var frameSizeScaleY = frameHeight / frameToDraw.sourceSize.h;
      if (width) {
        x += (frameToDraw.spriteSourceSize.x * dWidth / frameToDraw.sourceSize.w);
        dWidth = width * frameSizeScaleX;
      } else {
        x += frameToDraw.spriteSourceSize.x;
      }
      if (height) {
        y += (frameToDraw.spriteSourceSize.y * dHeight / frameToDraw.sourceSize.h);
        dHeight = height * frameSizeScaleY;
      } else {
        y += frameToDraw.spriteSourceSize.y;
      }
    }
    if (this.image instanceof Image) {
      pInst.imageElement(this.image, frameToDraw.frame.x, frameToDraw.frame.y,
        frameToDraw.frame.width, frameToDraw.frame.height, x, y, dWidth, dHeight);
    } else {
      pInst.image(this.image, frameToDraw.frame.x, frameToDraw.frame.y,
        frameToDraw.frame.width, frameToDraw.frame.height, x, y, dWidth, dHeight);
    }
  };

  /**
   * Objects are passed by reference so to have different sprites
   * using the same animation you need to clone it.
   *
   * @method clone
   * @return {SpriteSheet} A clone of the current SpriteSheet
   */
  this.clone = function() {
    var myClone = new SpriteSheet(pInst); //empty

    // Deep clone the frames by value not reference
    for(var i = 0; i < this.frames.length; i++) {
      var frame = this.frames[i].frame;
      var cloneFrame = {
        'name':frame.name,
        'frame': {
          'x':frame.x,
          'y':frame.y,
          'width':frame.width,
          'height':frame.height
        }
      };
      myClone.frames.push(cloneFrame);
    }

    // clone other fields
    myClone.image = this.image;
    myClone.frame_width = this.frame_width;
    myClone.frame_height = this.frame_height;
    myClone.num_frames = this.num_frames;

    return myClone;
  };
}

defineLazyP5Property('SpriteSheet', boundConstructorFactory(SpriteSheet));

//general constructor to be able to feed arguments as array
function construct(constructor, args) {
  function F() {
    return constructor.apply(this, args);
  }
  F.prototype = constructor.prototype;
  return new F();
}





/*
 * Javascript Quadtree
 * based on
 * https://github.com/timohausmann/quadtree-js/
 * Copyright © 2012 Timo Hausmann
*/

function Quadtree( bounds, max_objects, max_levels, level ) {

  this.active = true;
  this.max_objects	= max_objects || 10;
  this.max_levels		= max_levels || 4;

  this.level 			= level || 0;
  this.bounds 		= bounds;

  this.objects 		= [];
  this.object_refs	= [];
  this.nodes 			= [];
}

Quadtree.prototype.updateBounds = function() {

  //find maximum area
  var objects = this.getAll();
  var x = 10000;
  var y = 10000;
  var w = -10000;
  var h = -10000;

  for( var i=0; i < objects.length; i++ )
    {
      if(objects[i].position.x < x)
        x = objects[i].position.x;
      if(objects[i].position.y < y)
        y = objects[i].position.y;
      if(objects[i].position.x > w)
        w = objects[i].position.x;
      if(objects[i].position.y > h)
        h = objects[i].position.y;
    }


  this.bounds = {
    x:x,
    y:y,
    width:w,
    height:h
  };
  //print(this.bounds);
};

/*
	 * Split the node into 4 subnodes
	 */
Quadtree.prototype.split = function() {

  var nextLevel	= this.level + 1,
      subWidth	= Math.round( this.bounds.width / 2 ),
      subHeight 	= Math.round( this.bounds.height / 2 ),
      x 			= Math.round( this.bounds.x ),
      y 			= Math.round( this.bounds.y );

  //top right node
  this.nodes[0] = new Quadtree({
    x	: x + subWidth,
    y	: y,
    width	: subWidth,
    height	: subHeight
  }, this.max_objects, this.max_levels, nextLevel);

  //top left node
  this.nodes[1] = new Quadtree({
    x	: x,
    y	: y,
    width	: subWidth,
    height	: subHeight
  }, this.max_objects, this.max_levels, nextLevel);

  //bottom left node
  this.nodes[2] = new Quadtree({
    x	: x,
    y	: y + subHeight,
    width	: subWidth,
    height	: subHeight
  }, this.max_objects, this.max_levels, nextLevel);

  //bottom right node
  this.nodes[3] = new Quadtree({
    x	: x + subWidth,
    y	: y + subHeight,
    width	: subWidth,
    height	: subHeight
  }, this.max_objects, this.max_levels, nextLevel);
};


/*
	 * Determine the quadtrant for an area in this node
	 */
Quadtree.prototype.getIndex = function( pRect ) {
  if(!pRect.collider)
    return -1;
  else
  {
    var colliderBounds = pRect.collider.getBoundingBox();
    var index 				= -1,
        verticalMidpoint 	= this.bounds.x + (this.bounds.width / 2),
        horizontalMidpoint 	= this.bounds.y + (this.bounds.height / 2),

        //pRect can completely fit within the top quadrants
        topQuadrant = (colliderBounds.top < horizontalMidpoint && colliderBounds.bottom < horizontalMidpoint),

        //pRect can completely fit within the bottom quadrants
        bottomQuadrant = (colliderBounds.top > horizontalMidpoint);

    //pRect can completely fit within the left quadrants
    if (colliderBounds.left < verticalMidpoint && colliderBounds.right < verticalMidpoint ) {
      if( topQuadrant ) {
        index = 1;
      } else if( bottomQuadrant ) {
        index = 2;
      }

      //pRect can completely fit within the right quadrants
    } else if( colliderBounds.left > verticalMidpoint ) {
      if( topQuadrant ) {
        index = 0;
      } else if( bottomQuadrant ) {
        index = 3;
      }
    }

    return index;
  }
};


/*
	 * Insert an object into the node. If the node
	 * exceeds the capacity, it will split and add all
	 * objects to their corresponding subnodes.
	 */
Quadtree.prototype.insert = function( obj ) {
  //avoid double insertion
  if(this.objects.indexOf(obj) === -1)
  {

    var i = 0,
        index;

    //if we have subnodes ...
    if( typeof this.nodes[0] !== 'undefined' ) {
      index = this.getIndex( obj );

      if( index !== -1 ) {
        this.nodes[index].insert( obj );
        return;
      }
    }

    this.objects.push( obj );

    if( this.objects.length > this.max_objects && this.level < this.max_levels ) {

      //split if we don't already have subnodes
      if( typeof this.nodes[0] === 'undefined' ) {
        this.split();
      }

      //add all objects to there corresponding subnodes
      while( i < this.objects.length ) {

        index = this.getIndex( this.objects[i] );

        if( index !== -1 ) {
          this.nodes[index].insert( this.objects.splice(i, 1)[0] );
        } else {
          i = i + 1;
        }
      }
    }
  }
};


/*
	 * Return all objects that could collide with a given area
	 */
Quadtree.prototype.retrieve = function( pRect ) {


  var index = this.getIndex( pRect ),
      returnObjects = this.objects;

  //if we have subnodes ...
  if( typeof this.nodes[0] !== 'undefined' ) {

    //if pRect fits into a subnode ..
    if( index !== -1 ) {
      returnObjects = returnObjects.concat( this.nodes[index].retrieve( pRect ) );

      //if pRect does not fit into a subnode, check it against all subnodes
    } else {
      for( var i=0; i < this.nodes.length; i=i+1 ) {
        returnObjects = returnObjects.concat( this.nodes[i].retrieve( pRect ) );
      }
    }
  }

  return returnObjects;
};

Quadtree.prototype.retrieveFromGroup = function( pRect, group ) {

  var results = [];
  var candidates = this.retrieve(pRect);

  for(var i=0; i<candidates.length; i++)
    if(group.contains(candidates[i]))
    results.push(candidates[i]);

  return results;
};

/*
	 * Get all objects stored in the quadtree
	 */
Quadtree.prototype.getAll = function() {

  var objects = this.objects;

  for( var i=0; i < this.nodes.length; i=i+1 ) {
    objects = objects.concat( this.nodes[i].getAll() );
  }

  return objects;
};


/*
	 * Get the node in which a certain object is stored
	 */
Quadtree.prototype.getObjectNode = function( obj ) {

  var index;

  //if there are no subnodes, object must be here
  if( !this.nodes.length ) {

    return this;

  } else {

    index = this.getIndex( obj );

    //if the object does not fit into a subnode, it must be here
    if( index === -1 ) {

      return this;

      //if it fits into a subnode, continue deeper search there
    } else {
      var node = this.nodes[index].getObjectNode( obj );
      if( node ) return node;
    }
  }

  return false;
};


/*
	 * Removes a specific object from the quadtree
	 * Does not delete empty subnodes. See cleanup-function
	 */
Quadtree.prototype.removeObject = function( obj ) {

  var node = this.getObjectNode( obj ),
      index = node.objects.indexOf( obj );

  if( index === -1 ) return false;

  node.objects.splice( index, 1);
};


/*
	 * Clear the quadtree and delete all objects
	 */
Quadtree.prototype.clear = function() {

  this.objects = [];

  if( !this.nodes.length ) return;

  for( var i=0; i < this.nodes.length; i=i+1 ) {

    this.nodes[i].clear();
  }

  this.nodes = [];
};


/*
	 * Clean up the quadtree
	 * Like clear, but objects won't be deleted but re-inserted
	 */
Quadtree.prototype.cleanup = function() {

  var objects = this.getAll();

  this.clear();

  for( var i=0; i < objects.length; i++ ) {
    this.insert( objects[i] );
  }
};



function updateTree() {
  if(this.quadTree.active)
  {
    this.quadTree.updateBounds();
    this.quadTree.cleanup();
  }
}

//keyboard input
p5.prototype.registerMethod('pre', p5.prototype.readPresses);

//automatic sprite update
p5.prototype.registerMethod('pre', p5.prototype.updateSprites);

//quadtree update
p5.prototype.registerMethod('post', updateTree);

//camera push and pop
p5.prototype.registerMethod('pre', cameraPush);
p5.prototype.registerMethod('post', cameraPop);

p5.prototype.registerPreloadMethod('loadImageElement', p5.prototype);

//deltaTime
//p5.prototype.registerMethod('pre', updateDelta);

/**
 * Log a warning message to the host console, using native `console.warn`
 * if it is available but falling back on `console.log` if not.  If no
 * console is available, this method will fail silently.
 * @method _warn
 * @param {!string} message
 * @private
 */
p5.prototype._warn = function(message) {
  var console = window.console;

  if(console)
  {
    if('function' === typeof console.warn)
    {
      console.warn(message);
    }
    else if('function' === typeof console.log)
    {
      console.log('Warning: ' + message);
    }
  }
};

  /**
   * Collision Shape Base Class
   *
   * We have a set of collision shapes available that all conform to
   * a simple interface so that they can be checked against one another
   * using the Separating Axis Theorem.
   *
   * This base class implements all the required methods for a collision
   * shape and can be used as a collision point with no changes.
   * Other shapes should inherit from this and override most methods.
   *
   * @class p5.CollisionShape
   * @constructor
   * @param {p5.Vector} [center] (zero if omitted)
   * @param {number} [rotation] (zero if omitted)
   */
  p5.CollisionShape = function(center, rotation) {
    /**
     * Transform of this shape relative to its parent.  If there is no parent,
     * this is pretty much the world-space transform.
     * This should stay consistent with _offset, _rotation and _scale properties.
     * @property _localTransform
     * @type {p5.Transform2D}
     * @protected
     */
    this._localTransform = new p5.Transform2D();
    if (rotation) {
      this._localTransform.rotate(rotation);
    }
    if (center) {
      this._localTransform.translate(center);
    }

    /**
     * Transform of whatever parent object (probably a sprite) this shape is
     * associated with.  If this is a free-floating shape, the parent transform
     * will remain an identity matrix.
     * @property _parentTransform
     * @type {p5.Transform2D}
     * @protected
     */
    this._parentTransform = new p5.Transform2D();

    /**
     * The center of the collision shape in world-space.
     * @property _center
     * @private
     * @type {p5.Vector}
     */
    this._center = new p5.Vector();

    /**
     * The center of the collision shape in local-space; also, the offset of the
     * collision shape's center from its parent sprite's center.
     * @property _offset
     * @type {p5.Vector}
     * @private
     */
    this._offset = new p5.Vector();

    /**
     * Rotation in radians in local space (relative to parent).
     * Note that this will only be meaningful for shapes that can rotate,
     * i.e. Oriented Bounding Boxes
     * @property _rotation
     * @private
     * @type {number}
     */
    this._rotation = 0;

    /**
     * Scale X and Y in local space.  Note that this will only be meaningful
     * for shapes that have dimensions (e.g. not for point colliders)
     * @property _scale
     * @type {p5.Vector}
     * @private
     */
    this._scale = new p5.Vector(1, 1);

    /**
     * If true, when calling `updateFromSprite` this collider will adopt the
     * base dimensions of the sprite in addition to adopting its transform.
     * If false, only the transform (position/rotation/scale) will be adopted.
     * @property getsDimensionsFromSprite
     * @type {boolean}
     */
    this.getsDimensionsFromSprite = false;

    // Public getters/setters
    Object.defineProperties(this, {

      /**
       * The center of the collision shape in world-space.
       * Note: You can set this property with a value in world-space, but it will
       * actually modify the collision shape's local transform.
       * @property center
       * @type {p5.Vector}
       */
      'center': {
        enumerable: true,
        get: function() {
          return this._center.copy();
        }.bind(this),
        set: function(c) {
          this._localTransform
            .translate(p5.Vector.mult(this._center, -1))
            .translate(c);
          this._onTransformChanged();
        }.bind(this)
      },

      /**
       * The center of the collision shape in local-space - if this collider is
       * owned by a sprite, the offset of the collider center from the sprite center.
       * @property offset
       * @type {p5.Vector}
       */
      'offset': {
        enumerable: true,
        get: function() {
          return this._offset.copy();
        }.bind(this),
        set: function(o) {
          this._localTransform
            .translate(p5.Vector.mult(this._offset, -1))
            .translate(o);
          this._onTransformChanged();
        }.bind(this)
      },

      /**
       * The local-space rotation of the collider, in radians.
       * @property rotation
       * @type {number}
       */
      'rotation': {
        enumerable: true,
        get: function() {
          return this._rotation;
        }.bind(this),
        set: function(r) {
          this._localTransform
            .clear()
            .scale(this._scale)
            .rotate(r)
            .translate(this._offset);
          this._onTransformChanged();
        }.bind(this)
      },

      /**
       * The local-space scale of the collider
       * @property scale
       * @type {p5.Vector}
       */
      'scale': {
        enumerable: true,
        get: function() {
          return this._scale.copy();
        }.bind(this),
        set: function(s) {
          this._localTransform
            .clear()
            .scale(s)
            .rotate(this._rotation)
            .translate(this._offset);
          this._onTransformChanged();
        }.bind(this)
      }
    });

    this._onTransformChanged();
  };

  /**
   * Update this collider based on the properties of a parent Sprite.
   * Descendant classes should override this method to adopt the dimensions
   * of the sprite if `getsDimensionsFromSprite` is true.
   * @method updateFromSprite
   * @param {Sprite} sprite
   * @see p5.CollisionShape.prototype.getsDimensionsFromSprite
   */
  p5.CollisionShape.prototype.updateFromSprite = function(sprite) {
    this.setParentTransform(sprite);
  };

  /**
   * Update this collider's parent transform, which will in turn adjust its
   * position, rotation and scale in world-space and recompute cached values
   * if necessary.
   * If a Sprite is passed as the 'parent' then a new transform will be computed
   * from the sprite's position/rotation/scale and used.
   * @method setParentTransform
   * @param {p5.Transform2D|Sprite} parent
   */
  p5.CollisionShape.prototype.setParentTransform = function(parent) {
    if (parent instanceof Sprite) {
      this._parentTransform
        .clear()
        .scale(parent._getScaleX(), parent._getScaleY())
        .rotate(radians(parent.rotation))
        .translate(parent.position);
    } else if (parent instanceof p5.Transform2D) {
      this._parentTransform = parent.copy();
    } else {
      throw new TypeError('Bad argument to setParentTransform: ' + parent);
    }
    this._onTransformChanged();
  };

  /**
   * Recalculate cached properties, relevant vectors, etc. when at least one
   * of the shape's transforms changes.  The base CollisionShape (and PointCollider)
   * only need to recompute the shape's center, but other shapes may need to
   * override this method and do additional recomputation.
   * @method _onTransformChanged
   * @protected
   */
  p5.CollisionShape.prototype._onTransformChanged = function() {
    // Recompute internal properties from transforms

    // Rotation in local space
    this._rotation = this._localTransform.getRotation();

    // Scale in local space
    this._scale = this._localTransform.getScale();

    // Offset in local-space
    this._offset
      .set(0, 0)
      .transform(this._localTransform);

    // Center in world-space
    this._center
      .set(this._offset.x, this._offset.y)
      .transform(this._parentTransform);
  };

  /**
   * Compute the smallest movement needed to move this collision shape out of
   * another collision shape.  If the shapes are not overlapping, returns a
   * zero vector to indicate that no displacement is necessary.
   * @method collide
   * @param {p5.CollisionShape} other
   * @return {p5.Vector}
   */
  p5.CollisionShape.prototype.collide = function(other) {
    var displacee = this, displacer = other;

    // Compute a displacement vector using the Separating Axis Theorem
    // (Valid only for convex shapes)
    //
    // If a line (axis) exists on which the two shapes' orthogonal projections
    // do not overlap, then the shapes do not overlap.  If the shapes'
    // projections do overlap on all candidate axes, the axis that had the
    // smallest overlap gives us the smallest possible displacement.
    //
    // @see http://www.dyn4j.org/2010/01/sat/
    var smallestOverlap = Infinity;
    var smallestOverlapAxis = null;

    // We speed things up with an additional assumption that all collision
    // shapes are centrosymmetric: Circles, ellipses, and rectangles
    // are OK.  This lets us only compare the shapes' radii to the
    // distance between their centers, even for non-circular shapes.
    // Other convex shapes, (triangles, pentagons) will require more
    // complex use of their projections' positions on the axis.
    var deltaOfCenters = p5.Vector.sub(displacer.center, displacee.center);

    // It turns out we only need to check a few axes, defined by the shapes
    // being checked.  For a polygon, the normal of each face is a possible
    // separating axis.
    var candidateAxes = p5.CollisionShape._getCandidateAxesForShapes(displacee, displacer);
    var axis, deltaOfCentersOnAxis, distanceOfCentersOnAxis;
    for (var i = 0; i < candidateAxes.length; i++) {
      axis = candidateAxes[i];

      // If distance between the shape's centers as projected onto the
      // separating axis is larger than the combined radii of the shapes
      // projected onto the axis, the shapes do not overlap on this axis.
      deltaOfCentersOnAxis = p5.Vector.project(deltaOfCenters, axis);
      distanceOfCentersOnAxis = deltaOfCentersOnAxis.mag();
      var r1 = displacee._getRadiusOnAxis(axis);
      var r2 = displacer._getRadiusOnAxis(axis);
      var overlap = r1 + r2 - distanceOfCentersOnAxis;
      if (overlap <= 0) {
        // These shapes are separated along this axis.
        // Early-out, returning a zero-vector displacement.
        return new p5.Vector();
      } else if (overlap < smallestOverlap) {
        // This is the smallest overlap we've found so far - store some
        // information about it, which we can use to give the smallest
        // displacement when we're done.
        smallestOverlap = overlap;
        // Normally use the delta of centers, which gives us direction along
        // with an axis.  In the rare case that the centers exactly overlap,
        // just use the original axis
        if (deltaOfCentersOnAxis.x === 0 && deltaOfCentersOnAxis.y === 0) {
          smallestOverlapAxis = axis;
        } else {
          smallestOverlapAxis = deltaOfCentersOnAxis;
        }
      }
    }

    // If we make it here, we overlap on all possible axes and we
    // can compute the smallest vector that will displace this out of other.
    return smallestOverlapAxis.copy().setMag(-smallestOverlap);
  };


  /**
   * Check whether this shape overlaps another.
   * @method overlap
   * @param {p5.CollisionShape} other
   * @return {boolean}
   */
  p5.CollisionShape.prototype.overlap = function(other) {
    var displacement = this.collide(other);
    return displacement.x !== 0 || displacement.y !== 0;
  };

  /**
   * @method _getCanididateAxesForShapes
   * @private
   * @static
   * @param {p5.CollisionShape} shape1
   * @param {p5.CollisionShape} shape2
   * @return {Array.<p5.Vector>}
   */
  p5.CollisionShape._getCandidateAxesForShapes = function(shape1, shape2) {
    var axes = shape1._getCandidateAxes(shape2)
      .concat(shape2._getCandidateAxes(shape1))
      .map(function(axis) {
        if (axis.x === 0 && axis.y === 0) {
          return p5.CollisionShape.X_AXIS;
        }
        return axis;
      });
    return deduplicateParallelVectors(axes);
  };

  /*
   * Reduce an array of vectors to a set of unique axes (that is, no two vectors
   * in the array should be parallel).
   * @param {Array.<p5.Vector>} array
   * @return {Array}
   */
  function deduplicateParallelVectors(array) {
    return array.filter(function(item, itemPos) {
      return !array.some(function(other, otherPos) {
        return itemPos < otherPos && item.isParallel(other);
      });
    });
  }

  /**
   * Compute candidate separating axes relative to another object.
   * Override this method in subclasses to implement collision behavior.
   * @method _getCandidateAxes
   * @protected
   * @return {Array.<p5.Vector>}
   */
  p5.CollisionShape.prototype._getCandidateAxes = function() {
    return [];
  };

  /**
   * Get this shape's radius (half-width of its projection) along the given axis.
   * Override this method in subclasses to implement collision behavior.
   * @method _getRadiusOnAxis
   * @protected
   * @param {p5.Vector} axis
   * @return {number}
   */
  p5.CollisionShape.prototype._getRadiusOnAxis = function() {
    return 0;
  };

  /**
   * Get the shape's minimum radius on any axis for tunneling checks.
   * @method _getMinRadius
   * @protected
   * @param {p5.Vector} axis
   * @return {number}
   */
  p5.CollisionShape.prototype._getMinRadius = function() {
    return 0;
  };

  /**
   * @property X_AXIS
   * @type {p5.Vector}
   * @static
   * @final
   */
  p5.CollisionShape.X_AXIS = new p5.Vector(1, 0);

  /**
   * @property Y_AXIS
   * @type {p5.Vector}
   * @static
   * @final
   */
  p5.CollisionShape.Y_AXIS = new p5.Vector(0, 1);

  /**
   * @property WORLD_AXES
   * @type {Array.<p5.Vector>}
   * @static
   * @final
   */
  p5.CollisionShape.WORLD_AXES = [
    p5.CollisionShape.X_AXIS,
    p5.CollisionShape.Y_AXIS
  ];

  /**
   * Get world-space axis-aligned bounds information for this collision shape.
   * Used primarily for the quadtree.
   * @method getBoundingBox
   * @return {{top: number, bottom: number, left: number, right: number, width: number, height: number}}
   */
  p5.CollisionShape.prototype.getBoundingBox = function() {
    var radiusOnX = this._getRadiusOnAxis(p5.CollisionShape.X_AXIS);
    var radiusOnY = this._getRadiusOnAxis(p5.CollisionShape.Y_AXIS);
    return {
      top: this.center.y - radiusOnY,
      bottom: this.center.y + radiusOnY,
      left: this.center.x - radiusOnX,
      right: this.center.x + radiusOnX,
      width: radiusOnX * 2,
      height: radiusOnY * 2
    };
  };

  /**
   * A point collision shape, used to detect overlap and displacement vectors
   * vs other collision shapes.
   * @class p5.PointCollider
   * @constructor
   * @extends p5.CollisionShape
   * @param {p5.Vector} center
   */
  p5.PointCollider = function(center) {
    p5.CollisionShape.call(this, center);
  };
  p5.PointCollider.prototype = Object.create(p5.CollisionShape.prototype);

  /**
   * Construct a new PointCollider with given offset for the given sprite.
   * @method createFromSprite
   * @static
   * @param {Sprite} sprite
   * @param {p5.Vector} [offset] from the sprite's center
   * @return {p5.PointCollider}
   */
  p5.PointCollider.createFromSprite = function(sprite, offset) {
    // Create the collision shape at the transformed offset
    var shape = new p5.PointCollider(offset);
    shape.setParentTransform(sprite);
    return shape;
  };

  /**
   * Debug-draw this point collider
   * @method draw
   * @param {p5} sketch instance to use for drawing
   */
  p5.PointCollider.prototype.draw = function(sketch) {
    sketch.push();
    sketch.rectMode(sketch.CENTER);
    sketch.translate(this.center.x, this.center.y);
    sketch.noStroke();
    sketch.fill(0, 255, 0);
    sketch.ellipse(0, 0, 2, 2);
    sketch.pop();
  };

  /**
   * A Circle collision shape, used to detect overlap and displacement vectors
   * with other collision shapes.
   * @class p5.CircleCollider
   * @constructor
   * @extends p5.CollisionShape
   * @param {p5.Vector} center
   * @param {number} radius
   */
  p5.CircleCollider = function(center, radius) {
    p5.CollisionShape.call(this, center);

    /**
     * The unscaled radius of the circle collider.
     * @property radius
     * @type {number}
     */
    this.radius = radius;

    /**
     * Final radius of this circle after being scaled by parent and local transforms,
     * cached so we don't recalculate it all the time.
     * @property _scaledRadius
     * @type {number}
     * @private
     */
    this._scaledRadius = 0;

    this._computeScaledRadius();
  };
  p5.CircleCollider.prototype = Object.create(p5.CollisionShape.prototype);

  /**
   * Construct a new CircleCollider with given offset for the given sprite.
   * @method createFromSprite
   * @static
   * @param {Sprite} sprite
   * @param {p5.Vector} [offset] from the sprite's center
   * @param {number} [radius]
   * @return {p5.CircleCollider}
   */
  p5.CircleCollider.createFromSprite = function(sprite, offset, radius) {
    var customSize = typeof radius === 'number';
    var shape = new p5.CircleCollider(
      offset,
      customSize ? radius : 1
    );
    shape.getsDimensionsFromSprite = !customSize;
    shape.updateFromSprite(sprite);
    return shape;
  };

  /**
   * Update this collider based on the properties of a parent Sprite.
   * @method updateFromSprite
   * @param {Sprite} sprite
   * @see p5.CollisionShape.prototype.getsDimensionsFromSprite
   */
  p5.CircleCollider.prototype.updateFromSprite = function(sprite) {
    if (this.getsDimensionsFromSprite) {
      if (sprite.animation) {
        this.radius = Math.max(sprite.animation.getWidth(), sprite.animation.getHeight())/2;
      } else {
        this.radius = Math.max(sprite.width, sprite.height)/2;
      }
    }
    this.setParentTransform(sprite);
  };

  /**
   * Recalculate cached properties, relevant vectors, etc. when at least one
   * of the shape's transforms changes.  The base CollisionShape (and PointCollider)
   * only need to recompute the shape's center, but other shapes may need to
   * override this method and do additional recomputation.
   * @method _onTransformChanged
   * @protected
   */
  p5.CircleCollider.prototype._onTransformChanged = function() {
    p5.CollisionShape.prototype._onTransformChanged.call(this);
    this._computeScaledRadius();
  };

  /**
   * Call to update the cached scaled radius value.
   * @method _computeScaledRadius
   * @private
   */
  p5.CircleCollider.prototype._computeScaledRadius = function() {
    this._scaledRadius = new p5.Vector(this.radius, 0)
      .transform(this._localTransform)
      .transform(this._parentTransform)
      .sub(this.center)
      .mag();
  };

  /**
   * Debug-draw this collision shape.
   * @method draw
   * @param {p5} sketch instance to use for drawing
   */
  p5.CircleCollider.prototype.draw = function(sketch) {
    sketch.push();
    sketch.noFill();
    sketch.stroke(0, 255, 0);
    sketch.rectMode(sketch.CENTER);
    sketch.ellipse(this.center.x, this.center.y, this._scaledRadius*2, this._scaledRadius*2);
    sketch.pop();
  };

    /**
   * Overrides CollisionShape.setParentTransform
   * Update this collider's parent transform, which will in turn adjust its
   * position, rotation and scale in world-space and recompute cached values
   * if necessary.
   * If a Sprite is passed as the 'parent' then a new transform will be computed
   * from the sprite's position/rotation/scale and used.
   * Use the max of the x and y scales values so the circle encompasses the sprite.
   * @method setParentTransform
   * @param {p5.Transform2D|Sprite} parent
   */
  p5.CircleCollider.prototype.setParentTransform = function(parent) {
    if (parent instanceof Sprite) {
      this._parentTransform
        .clear()
        .scale(Math.max(parent._getScaleX(), parent._getScaleY()))
        .rotate(radians(parent.rotation))
        .translate(parent.position);
    } else if (parent instanceof p5.Transform2D) {
      this._parentTransform = parent.copy();
    } else {
      throw new TypeError('Bad argument to setParentTransform: ' + parent);
    }
    this._onTransformChanged();
  };

  /**
   * Compute candidate separating axes relative to another object.
   * @method _getCandidateAxes
   * @protected
   * @param {p5.CollisionShape} other
   * @return {Array.<p5.Vector>}
   */
  p5.CircleCollider.prototype._getCandidateAxes = function(other) {
    // A circle has infinite potential candidate axes, so the ones we pick
    // depend on what we're colliding against.

    // TODO: If we can ask the other shape for a list of vertices, then we can
    //       generalize this algorithm by always using the closest one, and
    //       remove the special knowledge of OBB and AABB.

    if (other instanceof p5.OrientedBoundingBoxCollider || other instanceof p5.AxisAlignedBoundingBoxCollider) {
      // There are four possible separating axes with a box - one for each
      // of its vertices, through the center of the circle.
      // We need the closest one.
      var smallestSquareDistance = Infinity;
      var axisToClosestVertex = null;

      // Generate the set of vertices for the other shape
      var halfDiagonals = other.halfDiagonals;
      [
        p5.Vector.add(other.center, halfDiagonals[0]),
        p5.Vector.add(other.center, halfDiagonals[1]),
        p5.Vector.sub(other.center, halfDiagonals[0]),
        p5.Vector.sub(other.center, halfDiagonals[1])
      ].map(function(vertex) {
        // Transform each vertex into a vector from this collider center to
        // that vertex, which defines an axis we might want to check.
        return vertex.sub(this.center);
      }.bind(this)).forEach(function(vector) {
        // Figure out which vertex is closest and use its axis
        var squareDistance = vector.magSq();
        if (squareDistance < smallestSquareDistance) {
          smallestSquareDistance = squareDistance;
          axisToClosestVertex = vector;
        }
      });
      return [axisToClosestVertex];
    }

    // When checking against another circle or a point we only need to check the
    // axis through both shapes' centers.
    return [p5.Vector.sub(other.center, this.center)];
  };

  /**
   * Get this shape's radius (half-width of its projection) along the given axis.
   * @method _getRadiusOnAxis
   * @protected
   * @return {number}
   */
  p5.CircleCollider.prototype._getRadiusOnAxis = function() {
    return this._scaledRadius;
  };

  /**
   * Get the shape's minimum radius on any axis for tunneling checks.
   * @method _getMinRadius
   * @protected
   * @param {p5.Vector} axis
   * @return {number}
   */
  p5.CircleCollider.prototype._getMinRadius = function() {
    return this._scaledRadius;
  };

  /**
   * An Axis-Aligned Bounding Box (AABB) collision shape, used to detect overlap
   * and compute minimum displacement vectors with other collision shapes.
   *
   * Cannot be rotated - hence the name.  You might use this in place of an
   * OBB because it simplifies some of the math and may improve performance.
   *
   * @class p5.AxisAlignedBoundingBoxCollider
   * @constructor
   * @extends p5.CollisionShape
   * @param {p5.Vector} center
   * @param {number} width
   * @param {number} height
   */
  p5.AxisAlignedBoundingBoxCollider = function(center, width, height) {
    p5.CollisionShape.call(this, center);

    /**
     * Unscaled box width.
     * @property _width
     * @private
     * @type {number}
     */
    this._width = width;

    /**
     * Unscaled box height.
     * @property _width
     * @private
     * @type {number}
     */
    this._height = height;

    /**
     * Cached half-diagonals, used for computing a projected radius.
     * Already transformed into world-space.
     * @property _halfDiagonals
     * @private
     * @type {Array.<p5.Vector>}
     */
    this._halfDiagonals = [];

    Object.defineProperties(this, {

      /**
       * The untransformed width of the box collider.
       * Recomputes diagonals when set.
       * @property width
       * @type {number}
       */
      'width': {
        enumerable: true,
        get: function() {
          return this._width;
        }.bind(this),
        set: function(w) {
          this._width = w;
          this._halfDiagonals = this._computeHalfDiagonals();
        }.bind(this)
      },

      /**
       * The unrotated height of the box collider.
       * Recomputes diagonals when set.
       * @property height
       * @type {number}
       */
      'height': {
        enumerable: true,
        get: function() {
          return this._height;
        }.bind(this),
        set: function(h) {
          this._height = h;
          this._halfDiagonals = this._computeHalfDiagonals();
        }.bind(this)
      },

      /**
       * Two vectors representing adjacent half-diagonals of the box at its
       * current dimensions and orientation.
       * @property halfDiagonals
       * @readOnly
       * @type {Array.<p5.Vector>}
       */
      'halfDiagonals': {
        enumerable: true,
        get: function() {
          return this._halfDiagonals;
        }.bind(this)
      }
    });

    this._computeHalfDiagonals();
  };
  p5.AxisAlignedBoundingBoxCollider.prototype = Object.create(p5.CollisionShape.prototype);

  /**
   * Construct a new AxisAlignedBoundingBoxCollider with given offset for the given sprite.
   * @method createFromSprite
   * @static
   * @param {Sprite} sprite
   * @param {p5.Vector} [offset] from the sprite's center
   * @return {p5.CircleCollider}
   */
  p5.AxisAlignedBoundingBoxCollider.createFromSprite = function(sprite, offset, width, height) {
    var customSize = typeof width === 'number' && typeof height === 'number';
    var box = new p5.AxisAlignedBoundingBoxCollider(
      offset,
      customSize ? width : 1,
      customSize ? height : 1
    );
    box.getsDimensionsFromSprite = !customSize;
    box.updateFromSprite(sprite);
    return box;
  };

  /**
   * Update this collider based on the properties of a parent Sprite.
   * @method updateFromSprite
   * @param {Sprite} sprite
   * @see p5.CollisionShape.prototype.getsDimensionsFromSprite
   */
  p5.AxisAlignedBoundingBoxCollider.prototype.updateFromSprite = function(sprite) {
    if (this.getsDimensionsFromSprite) {
      if (sprite.animation) {
        this._width = sprite.animation.getWidth();
        this._height = sprite.animation.getHeight();
      } else {
        this._width = sprite.width;
        this._height = sprite.height;
      }
    }
    this.setParentTransform(sprite);
  };

  /**
   * Recalculate cached properties, relevant vectors, etc. when at least one
   * of the shape's transforms changes.  The base CollisionShape (and PointCollider)
   * only need to recompute the shape's center, but other shapes may need to
   * override this method and do additional recomputation.
   * @method _onTransformChanged
   * @protected
   */
  p5.AxisAlignedBoundingBoxCollider.prototype._onTransformChanged = function() {
    p5.CollisionShape.prototype._onTransformChanged.call(this);
    this._computeHalfDiagonals();
  };

  /**
   * Recompute this bounding box's half-diagonal vectors.
   * @method _computeHalfDiagonals
   * @private
   * @return {Array.<p5.Vector>}
   */
  p5.AxisAlignedBoundingBoxCollider.prototype._computeHalfDiagonals = function() {
    // We transform the rectangle (which may scale and rotate it) then compute
    // an axis-aligned bounding box _around_ it.
    var composedTransform = p5.Transform2D.mult(this._parentTransform, this._localTransform);
    var transformedDiagonals = [
      new p5.Vector(this._width / 2, -this._height / 2),
      new p5.Vector(this._width / 2, this._height / 2),
      new p5.Vector(-this._width / 2, this._height / 2)
    ].map(function(vertex) {
      return vertex.transform(composedTransform).sub(this.center);
    }.bind(this));

    var halfWidth = Math.max(
      Math.abs(transformedDiagonals[0].x),
      Math.abs(transformedDiagonals[1].x)
    );
    var halfHeight = Math.max(
      Math.abs(transformedDiagonals[1].y),
      Math.abs(transformedDiagonals[2].y)
    );

    this._halfDiagonals = [
      new p5.Vector(halfWidth, -halfHeight),
      new p5.Vector(halfWidth, halfHeight)
    ];
  };

  /**
   * Debug-draw this collider.
   * @method draw
   * @param {p5} sketch - p5 instance to use for drawing
   */
  p5.AxisAlignedBoundingBoxCollider.prototype.draw = function(sketch) {
    sketch.push();
    sketch.rectMode(sketch.CENTER);
    sketch.translate(this.center.x, this.center.y);
    sketch.noFill();
    sketch.stroke(0, 255, 0);
    sketch.strokeWeight(1);
    sketch.rect(0, 0, Math.abs(this._halfDiagonals[0].x) * 2, Math.abs(this._halfDiagonals[0].y) * 2);
    sketch.pop();
  };

  /**
   * Compute candidate separating axes relative to another object.
   * @method _getCandidateAxes
   * @protected
   * @return {Array.<p5.Vector>}
   */
  p5.AxisAlignedBoundingBoxCollider.prototype._getCandidateAxes = function() {
    return p5.CollisionShape.WORLD_AXES;
  };

  /**
   * Get this shape's radius (half-width of its projection) along the given axis.
   * @method _getRadiusOnAxis
   * @protected
   * @param {p5.Vector} axis
   * @return {number}
   */
  p5.AxisAlignedBoundingBoxCollider.prototype._getRadiusOnAxis = function(axis) {
    // How to project a rect onto an axis:
    // Project the center-corner vectors for two adjacent corners (cached here)
    // onto the axis.  The larger magnitude of the two is your projection's radius.
    return Math.max(
      p5.Vector.project(this._halfDiagonals[0], axis).mag(),
      p5.Vector.project(this._halfDiagonals[1], axis).mag());
  };

  /**
   * Get the shape's minimum radius on any axis for tunneling checks.
   * @method _getMinRadius
   * @protected
   * @param {p5.Vector} axis
   * @return {number}
   */
  p5.AxisAlignedBoundingBoxCollider.prototype._getMinRadius = function() {
    return Math.min(this._width, this._height);
  };

  /**
   * An Oriented Bounding Box (OBB) collision shape, used to detect overlap and
   * compute minimum displacement vectors with other collision shapes.
   * @class p5.OrientedBoundingBoxCollider
   * @constructor
   * @extends p5.CollisionShape
   * @param {p5.Vector} center of the rectangle in world-space
   * @param {number} width of the rectangle (when not rotated)
   * @param {number} height of the rectangle (when not rotated)
   * @param {number} rotation about center, in radians
   */
  p5.OrientedBoundingBoxCollider = function(center, width, height, rotation) {
    p5.CollisionShape.call(this, center, rotation);

    /**
     * Unscaled box width.
     * @property _width
     * @private
     * @type {number}
     */
    this._width = width;

    /**
     * Unscaled box height.
     * @property _width
     * @private
     * @type {number}
     */
    this._height = height;

    /**
     * Cached separating axes this shape contributes to a collision.
     * @property _potentialAxes
     * @private
     * @type {Array.<p5.Vector>}
     */
    this._potentialAxes = [];

    /**
     * Cached half-diagonals, used for computing a projected radius.
     * Already transformed into world-space.
     * @property _halfDiagonals
     * @private
     * @type {Array.<p5.Vector>}
     */
    this._halfDiagonals = [];

    Object.defineProperties(this, {

      /**
       * The unrotated width of the box collider.
       * Recomputes diagonals when set.
       * @property width
       * @type {number}
       */
      'width': {
        enumerable: true,
        get: function() {
          return this._width;
        }.bind(this),
        set: function(w) {
          this._width = w;
          this._onTransformChanged();
        }.bind(this)
      },

      /**
       * The unrotated height of the box collider.
       * Recomputes diagonals when set.
       * @property height
       * @type {number}
       */
      'height': {
        enumerable: true,
        get: function() {
          return this._height;
        }.bind(this),
        set: function(h) {
          this._height = h;
          this._onTransformChanged();
        }.bind(this)
      },

      /**
       * Two vectors representing adjacent half-diagonals of the box at its
       * current dimensions and orientation.
       * @property halfDiagonals
       * @readOnly
       * @type {Array.<p5.Vector>}
       */
      'halfDiagonals': {
        enumerable: true,
        get: function() {
          return this._halfDiagonals;
        }.bind(this)
      }
    });

    this._onTransformChanged();
  };
  p5.OrientedBoundingBoxCollider.prototype = Object.create(p5.CollisionShape.prototype);

  /**
   * Construct a new AxisAlignedBoundingBoxCollider with given offset for the given sprite.
   * @method createFromSprite
   * @static
   * @param {Sprite} sprite
   * @param {p5.Vector} [offset] from the sprite's center
   * @param {number} [width]
   * @param {number} [height]
   * @param {number} [rotation] in radians
   * @return {p5.CircleCollider}
   */
  p5.OrientedBoundingBoxCollider.createFromSprite = function(sprite, offset, width, height, rotation) {
    var customSize = typeof width === 'number' && typeof height === 'number';
    var box = new p5.OrientedBoundingBoxCollider(
      offset,
      customSize ? width : 1,
      customSize ? height : 1,
      rotation
    );
    box.getsDimensionsFromSprite = !customSize;
    box.updateFromSprite(sprite);
    return box;
  };

  /**
   * Update this collider based on the properties of a parent Sprite.
   * @method updateFromSprite
   * @param {Sprite} sprite
   * @see p5.CollisionShape.prototype.getsDimensionsFromSprite
   */
  p5.OrientedBoundingBoxCollider.prototype.updateFromSprite =
    p5.AxisAlignedBoundingBoxCollider.prototype.updateFromSprite;

  /**
   * Assuming this collider is a sprite's swept collider, update it based on
   * the properties of the parent sprite so that it encloses the sprite's
   * current position and its projected position.
   * @method updateSweptColliderFromSprite
   * @param {Sprite} sprite
   */
  p5.OrientedBoundingBoxCollider.prototype.updateSweptColliderFromSprite = function(sprite) {
    var vMagnitude = sprite.velocity.mag();
    var vPerpendicular = new p5.Vector(sprite.velocity.y, -sprite.velocity.x);
    this._width = vMagnitude + 2 * sprite.collider._getRadiusOnAxis(sprite.velocity);
    this._height = 2 * sprite.collider._getRadiusOnAxis(vPerpendicular);
    var newRotation = radians(sprite.getDirection());
    var newCenter = new p5.Vector(
      sprite.newPosition.x + 0.5 * sprite.velocity.x,
      sprite.newPosition.y + 0.5 * sprite.velocity.y
    );
    // Perform this.rotation = newRotation and this.center = newCenter;
    this._localTransform
      .clear()
      .scale(this._scale)
      .rotate(newRotation)
      .translate(this._offset)
      .translate(p5.Vector.mult(this._center, -1))
      .translate(newCenter);
    this._onTransformChanged();
  };

  /**
   * Recalculate cached properties, relevant vectors, etc. when at least one
   * of the shape's transforms changes.  The base CollisionShape (and PointCollider)
   * only need to recompute the shape's center, but other shapes may need to
   * override this method and do additional recomputation.
   * @method _onTransformChanged
   * @protected
   */
  p5.OrientedBoundingBoxCollider.prototype._onTransformChanged = function() {
    p5.CollisionShape.prototype._onTransformChanged.call(this);

    // Transform each vertex by the local and global matrices
    // then use their differences to determine width, height, and halfDiagonals
    var composedTransform = p5.Transform2D.mult(this._parentTransform, this._localTransform);
    var transformedVertices = [
      new p5.Vector(this._width / 2, -this._height / 2),
      new p5.Vector(this._width / 2, this._height / 2),
      new p5.Vector(-this._width / 2, this._height / 2)
    ].map(function(vertex) {
      return vertex.transform(composedTransform);
    });

    this._halfDiagonals = [
      p5.Vector.sub(transformedVertices[0], this.center),
      p5.Vector.sub(transformedVertices[1], this.center)
    ];

    this._potentialAxes = [
      p5.Vector.sub(transformedVertices[1], transformedVertices[2]),
      p5.Vector.sub(transformedVertices[1], transformedVertices[0])
    ];
  };

  /**
   * Debug-draw this collider.
   * @method draw
   * @param {p5} sketch - p5 instance to use for drawing
   */
  p5.OrientedBoundingBoxCollider.prototype.draw = function(sketch) {
    var composedTransform = p5.Transform2D.mult(this._localTransform, this._parentTransform);
    var scale = composedTransform.getScale();
    var rotation = composedTransform.getRotation();
    sketch.push();
    sketch.translate(this.center.x, this.center.y);
    sketch.scale(scale.x, scale.y);
    if (sketch._angleMode === sketch.RADIANS) {
      sketch.rotate(rotation);
    } else {
      sketch.rotate(degrees(rotation));
    }

    sketch.noFill();
    sketch.stroke(0, 255, 0);
    sketch.strokeWeight(1);
    sketch.rectMode(sketch.CENTER);
    sketch.rect(0, 0, this._width, this._height);
    sketch.pop();
  };

  /**
   * Compute candidate separating axes relative to another object.
   * @method _getCandidateAxes
   * @protected
   * @return {Array.<p5.Vector>}
   */
  p5.OrientedBoundingBoxCollider.prototype._getCandidateAxes = function() {
    // An oriented bounding box always provides two of its face normals,
    // which we've precomputed.
    return this._potentialAxes;
  };

  /**
   * Get this shape's radius (half-width of its projection) along the given axis.
   * @method _getRadiusOnAxis
   * @protected
   * @param {p5.Vector} axis
   * @return {number}
   */
  p5.OrientedBoundingBoxCollider.prototype._getRadiusOnAxis =
    p5.AxisAlignedBoundingBoxCollider.prototype._getRadiusOnAxis;
  // We can reuse the AABB version of this method because both are projecting
  // cached half-diagonals - the same code works.

  /**
   * When checking for tunneling through a OrientedBoundingBoxCollider use a
   * worst-case of zero (e.g. if the other sprite is passing through a corner).
   * @method _getMinRadius
   * @protected
   * @param {p5.Vector} axis
   * @return {number}
   */
  p5.OrientedBoundingBoxCollider.prototype._getMinRadius =
    p5.AxisAlignedBoundingBoxCollider.prototype._getMinRadius;

  /**
   * A 2D affine transformation (translation, rotation, scale) stored as a
   * 3x3 matrix that uses homogeneous coordinates.  Used to quickly transform
   * points or vectors between reference frames.
   * @class p5.Transform2D
   * @constructor
   * @extends Array
   * @param {p5.Transform2D|Array.<number>} [source]
   */
  p5.Transform2D = function(source) {
    // We only store the first six values.
    // the last row in a 2D transform matrix is always "0 0 1" so we can
    // save space and speed up certain calculations with this assumption.
    source = source || [1, 0, 0, 0, 1, 0];
    if (source.length !== 6) {
      throw new TypeError('Transform2D must have six components');
    }
    this.length = 6;
    this[0] = source[0];
    this[1] = source[1];
    this[2] = source[2];
    this[3] = source[3];
    this[4] = source[4];
    this[5] = source[5];
  };
  p5.Transform2D.prototype = Object.create(Array.prototype);

  /**
   * Reset this transform to an identity transform, in-place.
   * @method clear
   * @return {p5.Transform2D} this transform
   */
  p5.Transform2D.prototype.clear = function() {
    this[0] = 1;
    this[1] = 0;
    this[2] = 0;
    this[3] = 0;
    this[4] = 1;
    this[5] = 0;
    return this;
  };

  /**
   * Make a copy of this transform.
   * @method copy
   * @return {p5.Transform2D}
   */
  p5.Transform2D.prototype.copy = function() {
    return new p5.Transform2D(this);
  };

  /**
   * Check whether two transforms are the same.
   * @method equals
   * @param {p5.Transform2D|Array.<number>} other
   * @return {boolean}
   */
  p5.Transform2D.prototype.equals = function(other) {
    if (!(other instanceof p5.Transform2D || Array.isArray(other))) {
      return false; // Never equal to other types.
    }

    for (var i = 0; i < 6; i++) {
      if (this[i] !== other[i]) {
        return false;
      }
    }
    return true;
  };

  /**
   * Multiply two transforms together, combining them.
   * Does not modify original transforms.  Assigns result into dest argument if
   * provided and returns it.  Otherwise returns a new transform.
   * @method mult
   * @static
   * @param {p5.Transform2D|Array.<number>} t1
   * @param {p5.Transform2D|Array.<number>} t2
   * @param {p5.Transform2D} [dest]
   * @return {p5.Transform2D}
   */
  p5.Transform2D.mult = function(t1, t2, dest) {
    dest = dest || new p5.Transform2D();

    // Capture values of original matrices in local variables, in case one of
    // them is the one we're mutating.
    var t1_0, t1_1, t1_2, t1_3, t1_4, t1_5;
    t1_0 = t1[0];
    t1_1 = t1[1];
    t1_2 = t1[2];
    t1_3 = t1[3];
    t1_4 = t1[4];
    t1_5 = t1[5];

    var t2_0, t2_1, t2_2, t2_3, t2_4, t2_5;
    t2_0 = t2[0];
    t2_1 = t2[1];
    t2_2 = t2[2];
    t2_3 = t2[3];
    t2_4 = t2[4];
    t2_5 = t2[5];

    dest[0] = t1_0*t2_0 + t1_1*t2_3;
    dest[1] = t1_0*t2_1 + t1_1*t2_4;
    dest[2] = t1_0*t2_2 + t1_1*t2_5 + t1_2;

    dest[3] = t1_3*t2_0 + t1_4*t2_3;
    dest[4] = t1_3*t2_1 + t1_4*t2_4;
    dest[5] = t1_3*t2_2 + t1_4*t2_5 + t1_5;

    return dest;
  };

  /**
   * Multiply this transform by another, combining them.
   * Modifies this transform and returns it.
   * @method mult
   * @param {p5.Transform2D|Float32Array|Array.<number>} other
   * @return {p5.Transform2D}
   */
  p5.Transform2D.prototype.mult = function(other) {
    return p5.Transform2D.mult(this, other, this);
  };

  /**
   * Modify this transform, translating it by a certain amount.
   * Returns this transform.
   * @method translate
   * @return {p5.Transform2D}
   * @example
   *     // Two different ways to call this method.
   *     var t = new p5.Transform();
   *     // 1. Two numbers
   *     t.translate(x, y);
   *     // 2. One vector
   *     t.translate(new p5.Vector(x, y));
   */
  p5.Transform2D.prototype.translate = function(arg0, arg1) {
    var x, y;
    if (arg0 instanceof p5.Vector) {
      x = arg0.x;
      y = arg0.y;
    } else if (typeof arg0 === 'number' && typeof arg1 === 'number') {
      x = arg0;
      y = arg1;
    } else {
      var args = '';
      for (var i = 0; i < arguments.length; i++) {
        args += arguments[i] + ', ';
      }
      throw new TypeError('Invalid arguments to Transform2D.translate: ' + args);
    }
    return p5.Transform2D.mult([
      1, 0, x,
      0, 1, y
    ], this, this);
  };

  /**
   * Retrieve the resolved translation of this transform.
   * @method getTranslation
   * @return {p5.Vector}
   */
  p5.Transform2D.prototype.getTranslation = function() {
    return new p5.Vector(this[2], this[5]);
  };

  /**
   * Modify this transform, scaling it by a certain amount.
   * Returns this transform.
   * @method scale
   * @return {p5.Transform2D}
   * @example
   *     // Three different ways to call this method.
   *     var t = new p5.Transform();
   *     // 1. One scalar value
   *     t.scale(uniformScale);
   *     // 1. Two scalar values
   *     t.scale(scaleX, scaleY);
   *     // 2. One vector
   *     t.translate(new p5.Vector(scaleX, scaleY));
   */
  p5.Transform2D.prototype.scale = function(arg0, arg1) {
    var sx, sy;
    if (arg0 instanceof p5.Vector) {
      sx = arg0.x;
      sy = arg0.y;
    } else if (typeof arg0 === 'number' && typeof arg1 === 'number') {
      sx = arg0;
      sy = arg1;
    } else if (typeof arg0 === 'number') {
      sx = arg0;
      sy = arg0;
    } else {
      throw new TypeError('Invalid arguments to Transform2D.scale: ' + arguments);
    }
    return p5.Transform2D.mult([
      sx, 0, 0,
      0, sy, 0
    ], this, this);
  };

  /**
   * Retrieve the scale vector of this transform.
   * @method getScale
   * @return {p5.Vector}
   */
  p5.Transform2D.prototype.getScale = function() {
    var a = this[0], b = this[1],
        c = this[3], d = this[4];
    return new p5.Vector(
      sign(a) * Math.sqrt(a*a + b*b),
      sign(d) * Math.sqrt(c*c + d*d)
    );
  };

  /*
   * Return -1, 0, or 1 depending on whether a number is negative, zero, or positive.
   */
  function sign(x) {
    x = +x; // convert to a number
    if (x === 0 || isNaN(x)) {
      return Number(x);
    }
    return x > 0 ? 1 : -1;
  }

  /**
   * Modify this transform, rotating it by a certain amount.
   * @method rotate
   * @param {number} radians
   * @return {p5.Transform2D}
   */
  p5.Transform2D.prototype.rotate = function(radians) {
    // Clockwise!
    if (typeof radians !== 'number') {
      throw new TypeError('Invalid arguments to Transform2D.rotate: ' + arguments);
    }
    var sinR = Math.sin(radians);
    var cosR = Math.cos(radians);
    return p5.Transform2D.mult([
      cosR, -sinR, 0,
      sinR, cosR, 0
    ], this, this);
  };

  /**
   * Retrieve the angle of this transform in radians.
   * @method getRotation
   * @return {number}
   */
  p5.Transform2D.prototype.getRotation = function() {
    // see http://math.stackexchange.com/a/13165
    return Math.atan2(-this[1], this[0]);
  };

  /**
   * Applies a 2D transformation matrix (using homogeneous coordinates, so 3x3)
   * to a Vector2 (<x, y, 1>) and returns a new vector2.
   * @method transform
   * @for p5.Vector
   * @static
   * @param {p5.Vector} v
   * @param {p5.Transform2D} t
   * @return {p5.Vector} a new vector
   */
  p5.Vector.transform = function(v, t) {
    return v.copy().transform(t);
  };

  /**
   * Transforms this vector by a 2D transformation matrix.
   * @method transform
   * @for p5.Vector
   * @param {p5.Transform2D} transform
   * @return {p5.Vector} this, after the change
   */
  p5.Vector.prototype.transform = function(transform) {
    // Note: We cheat a whole bunch here since this is just 2D!
    // Use a different method if looking for true matrix multiplication.
    var x = this.x;
    var y = this.y;
    this.x = transform[0]*x + transform[1]*y + transform[2];
    this.y = transform[3]*x + transform[4]*y + transform[5];
    return this;
  };

}));
