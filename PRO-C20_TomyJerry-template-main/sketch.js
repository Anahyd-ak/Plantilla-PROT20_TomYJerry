//Crear las variables de los elementos a usar (en este caso usarás un fondo, el personaje de tom, 
//sus dos imagenes de reacciones y la variable de jerry con sus dos imagenes de animación). 
//Te ayudare con el fondo y otros elementos
var canvas, fondo;
var together;


function preload() {
    //Cargar aqui las imagenes y animaciones de los personajes. Recuerda que hay distintos códigos 
    //para este tipo de ocasiones: loadImage para imagenes fijas y loadAnimation para las animaciones
    //o sensación de movimiento de las imagenes.
    //Otro punto a resaltar es que hay ciertos estados de los personajes: hay animaciones para cuando caminan
    //y animaciones para cuando se logran tocar, por lo que cargarás varias imagenes de animaciones por lo que 
    //debes considerar eso también en las variables que vas a crear.
}

function setup(){
    //Debes agregar un lienzo de fondo que determine el tamaño del área a trabajar. Ya hay una variable llamada
    //canvas sólo debes de agregar el código de createCanvas(1000,800) <--- Sugerencia de tamaño
    //Carga los sprites de Tom y Jerry junto con sus animaciones y sus tamaños. Recuerda que se usa el código
    // de sprite.scale = número; para reducir el tamaño de los sprites (partiendo que su tamaño real es 1).

}

function draw() {

    background(fondo);
    //escribe la condición para verificar si Tom y Jerry chocan (recuerda lo que hicimos con los rectangulos, sólo necesitamos
    //que se toquen por el lado derecho de e izquierdo de los personajes)
    
    drawSprites();
}

function keyPressed(){
    //Escribe aqui el código para la animación del movimiento y cambio, es decir, usa un condicional If para darle la propiedad 
    //a una tecla de las flechas para que uno de los personajes se mueva.

}