// Lazy-loaded background removal module
let removeBackgroundFn = null;
let modelLoaded = false;

// State
const processedImages = [];
let currentImageIndex = -1;

// DOM Elements
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const processingContainer = document.getElementById('processing-container');
const processingText = document.getElementById('processing-text');
const processingSubtext = document.getElementById('processing-subtext');
const progressFill = document.getElementById('progress-fill');
const resultContainer = document.getElementById('result-container');
const errorMessage = document.getElementById('error-message');
const originalImage = document.getElementById('original-image');
const resultImage = document.getElementById('result-image');
const imageBefore = document.getElementById('image-before');
const sliderLine = document.getElementById('slider-line');
const comparisonContainer = document.getElementById('comparison-container');
const downloadBtn = document.getElementById('download-btn');
const newImageBtn = document.getElementById('new-image-btn');
const queueContainer = document.getElementById('queue-container');
const queueList = document.getElementById('queue-list');

// Initialize model on first use
async function initializeModel() {
  if (removeBackgroundFn) return;

  updateProgress(0);
  processingText.textContent = 'Loading AI model...';
  processingSubtext.textContent = modelLoaded ? 'Preparing...' : 'First time may take a moment';

  try {
    const module = await import('@imgly/background-removal');
    removeBackgroundFn = module.removeBackground;
    modelLoaded = true;
    updateProgress(10);
  } catch (error) {
    throw new Error('Failed to load background removal model: ' + error.message);
  }
}

// Process image with background removal
async function processImage(file) {
  showProcessing();
  hideError();

  try {
    await initializeModel();

    processingText.textContent = 'Processing image...';
    processingSubtext.textContent = 'Analyzing and removing background';
    updateProgress(20);

    // Create object URL for original image
    const originalUrl = URL.createObjectURL(file);

    // Configure model - use local models path
    const config = {
      publicPath: window.location.origin + '/models/',
      model: 'medium',
      output: {
        format: 'image/png',
        quality: 1,
      },
      progress: (key, current, total) => {
        if (key === 'compute:inference') {
          const percentage = 20 + Math.round((current / total) * 70);
          updateProgress(percentage);
        }
      },
    };

    // Remove background
    const resultBlob = await removeBackgroundFn(file, config);
    updateProgress(95);

    // Create result URL
    const resultUrl = URL.createObjectURL(resultBlob);
    updateProgress(100);

    // Store in processed images
    const imageData = {
      original: originalUrl,
      result: resultUrl,
      resultBlob: resultBlob,
      name: file.name.replace(/\.[^/.]+$/, '') + '_nobg.png',
    };

    processedImages.push(imageData);
    currentImageIndex = processedImages.length - 1;

    // Show result
    showResult(imageData);
    updateQueue();

  } catch (error) {
    console.error('Error processing image:', error);
    showError(error.message || 'Failed to process image. Please try again.');
    hideProcessing();
    showUpload();
  }
}

// UI State Management
function showProcessing() {
  uploadZone.style.display = 'none';
  processingContainer.classList.add('active');
  resultContainer.classList.remove('active');
}

function hideProcessing() {
  processingContainer.classList.remove('active');
}

function showUpload() {
  uploadZone.style.display = 'block';
  resultContainer.classList.remove('active');
}

function showResult(imageData) {
  hideProcessing();
  uploadZone.style.display = 'none';

  originalImage.src = imageData.original;
  resultImage.src = imageData.result;

  // Reset slider position
  setSliderPosition(50);

  resultContainer.classList.add('active');
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('active');
}

function hideError() {
  errorMessage.classList.remove('active');
}

function updateProgress(percentage) {
  progressFill.style.width = percentage + '%';
}

// Comparison Slider
let isDragging = false;

function setSliderPosition(percentage) {
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  sliderLine.style.left = clampedPercentage + '%';
  // Use clip-path to reveal/hide the original image without resizing it
  imageBefore.style.clipPath = `inset(0 ${100 - clampedPercentage}% 0 0)`;
}

function handleSliderMove(clientX) {
  const rect = comparisonContainer.getBoundingClientRect();
  const x = clientX - rect.left;
  const percentage = (x / rect.width) * 100;
  setSliderPosition(percentage);
}

sliderLine.addEventListener('mousedown', (e) => {
  isDragging = true;
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    handleSliderMove(e.clientX);
  }
});

document.addEventListener('mouseup', () => {
  isDragging = false;
});

// Touch support
sliderLine.addEventListener('touchstart', (e) => {
  isDragging = true;
  e.preventDefault();
});

document.addEventListener('touchmove', (e) => {
  if (isDragging && e.touches.length === 1) {
    handleSliderMove(e.touches[0].clientX);
  }
});

document.addEventListener('touchend', () => {
  isDragging = false;
});

// Click on comparison area to move slider
comparisonContainer.addEventListener('click', (e) => {
  if (e.target !== sliderLine && !sliderLine.contains(e.target)) {
    handleSliderMove(e.clientX);
  }
});

// File Upload Handling
uploadZone.addEventListener('click', () => {
  fileInput.click();
});

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');

  const files = Array.from(e.dataTransfer.files).filter(file =>
    file.type.startsWith('image/')
  );

  if (files.length > 0) {
    handleFiles(files);
  }
});

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    handleFiles(files);
  }
  fileInput.value = '';
});

function handleFiles(files) {
  const validFiles = files.filter(file => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
      showError('Please upload JPG, PNG, or WebP images only.');
      return false;
    }

    if (file.size > maxSize) {
      showError('Image size must be less than 10MB.');
      return false;
    }

    return true;
  });

  if (validFiles.length > 0) {
    // Process first file, queue the rest
    processImage(validFiles[0]);

    // If multiple files, process them sequentially
    if (validFiles.length > 1) {
      processRemainingFiles(validFiles.slice(1));
    }
  }
}

async function processRemainingFiles(files) {
  for (const file of files) {
    await processImage(file);
  }
}

// Queue Management
function updateQueue() {
  if (processedImages.length <= 1) {
    queueContainer.classList.remove('active');
    return;
  }

  queueContainer.classList.add('active');
  queueList.innerHTML = '';

  processedImages.forEach((img, index) => {
    const item = document.createElement('div');
    item.className = 'queue-item' + (index === currentImageIndex ? ' active' : '');
    item.innerHTML = `
      <img src="${img.result}" alt="Processed image ${index + 1}">
      <div class="queue-item-status done">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    `;
    item.addEventListener('click', () => {
      currentImageIndex = index;
      showResult(processedImages[index]);
      updateQueue();
    });
    queueList.appendChild(item);
  });
}

// Download
downloadBtn.addEventListener('click', () => {
  if (currentImageIndex >= 0 && processedImages[currentImageIndex]) {
    const imageData = processedImages[currentImageIndex];
    const link = document.createElement('a');
    link.href = imageData.result;
    link.download = imageData.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
});

// New Image
newImageBtn.addEventListener('click', () => {
  showUpload();
  hideError();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (resultContainer.classList.contains('active')) {
    if (e.key === 'ArrowLeft' && currentImageIndex > 0) {
      currentImageIndex--;
      showResult(processedImages[currentImageIndex]);
      updateQueue();
    } else if (e.key === 'ArrowRight' && currentImageIndex < processedImages.length - 1) {
      currentImageIndex++;
      showResult(processedImages[currentImageIndex]);
      updateQueue();
    } else if (e.key === 'd' || e.key === 'D') {
      downloadBtn.click();
    } else if (e.key === 'n' || e.key === 'N') {
      newImageBtn.click();
    }
  }
});

