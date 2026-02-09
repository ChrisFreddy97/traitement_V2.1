//fonction pour revenir à la page d'accueil
const backToHomeBtn = document.getElementById('back-to-home-btn');

backToHomeBtn.addEventListener('click', () => {
    window.location.href = '../folderUpload.html';
});