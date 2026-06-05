let overlay = null;
let selectionBox = null;
let startX = 0, startY = 0;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start_crop") createCropOverlay();
});

function createCropOverlay() {
  if (overlay) return;
  overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.3);cursor:crosshair;z-index:999999;";
  document.body.appendChild(overlay);
  overlay.addEventListener("mousedown", onMouseDown);
}

function onMouseDown(e) {
  startX = e.clientX; startY = e.clientY;
  selectionBox = document.createElement("div");
  selectionBox.style.cssText = `position:absolute;border:2px dashed #00ffcc;background:rgba(0,255,204,0.1);left:${startX}px;top:${startY}px;`;
  overlay.appendChild(selectionBox);
  overlay.addEventListener("mousemove", onMouseMove);
  overlay.addEventListener("mouseup", onMouseUp);
}

function onMouseMove(e) {
  const left = Math.min(startX, e.clientX), top = Math.min(startY, e.clientY);
  const width = Math.abs(startX - e.clientX), height = Math.abs(startY - e.clientY);
  selectionBox.style.left = `${left}px`; selectionBox.style.top = `${top}px`;
  selectionBox.style.width = `${width}px`; selectionBox.style.height = `${height}px`;
}

async function onMouseUp(e) {
  const left = Math.min(startX, e.clientX), top = Math.min(startY, e.clientY);
  const width = Math.abs(startX - e.clientX), height = Math.abs(startY - e.clientY);
  overlay.remove(); overlay = null;

  if (width > 30 && height > 30) {
    startVisualMirror(left, top, width, height);
  }
}

async function startVisualMirror(cropX, cropY, cropWidth, cropHeight) {
  try {
    // 1. Pedir permiso para grabar la pestaña actual
    const stream = await navigator.mediaDevices.getDisplayMedia({ 
        preferCurrentTab: true, 
        video: { displaySurface: "browser" } 
    });

    const hiddenVideo = document.createElement("video");
    hiddenVideo.srcObject = stream;
    hiddenVideo.play();

    // 2. Crear un lienzo (canvas) del tamaño del recorte
    const canvas = document.createElement("canvas");
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext("2d");

    // 3. Crear el reproductor final que irá al PiP
    const pipVideo = document.createElement("video");
    pipVideo.srcObject = canvas.captureStream(30); // 30 FPS
    pipVideo.play();
    pipVideo.muted = true;
    document.body.appendChild(pipVideo);
    pipVideo.style.display = "none";

    // 4. Dibujar continuamente solo el recorte en el canvas
    hiddenVideo.addEventListener("play", () => {
      function drawFrame() {
        if (hiddenVideo.paused || hiddenVideo.ended) return;
        
        // Ajustar coordenadas según la resolución real del video capturado vs el tamaño de la ventana
        const scaleX = hiddenVideo.videoWidth / window.innerWidth;
        const scaleY = hiddenVideo.videoHeight / window.innerHeight;

        ctx.drawImage(
          hiddenVideo,
          cropX * scaleX, cropY * scaleY, cropWidth * scaleX, cropHeight * scaleY, // Origen (Recorte)
          0, 0, cropWidth, cropHeight // Destino (Canvas)
        );
        requestAnimationFrame(drawFrame);
      }
      drawFrame();
    });

    // 5. Lanzar el PiP nativo
    pipVideo.onloadedmetadata = async () => {
      await pipVideo.requestPictureInPicture();
    };

    // 6. Limpiar recursos al cerrar el PiP
    pipVideo.addEventListener("leavepictureinpicture", () => {
      stream.getTracks().forEach(t => t.stop());
      pipVideo.remove();
    });

  } catch (err) {
    console.error("Error al capturar la pestaña:", err);
  }
}