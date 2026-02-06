// Gestion de la navigation
document.addEventListener('DOMContentLoaded', function() {
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Retirer la classe active de tous les boutons
            navButtons.forEach(btn => btn.classList.remove('active'));
            
            // Ajouter la classe active au bouton cliqué
            this.classList.add('active');
            
            // Récupérer la cible
            const target = this.getAttribute('data-target');
            
            // Gérer la navigation selon la cible
            switch(target) {
                case 'files':
                    window.location.href = 'files.js';
                    break;
                case 'congel':
                    window.location.href = 'congel/congel.html';
                    break;
                case 'settings':
                    // Rediriger vers la page des paramètres
                    alert('Page des paramètres (à implémenter)');
                    break;
                // Pour 'home', on reste sur la page actuelle
            }
        });
    });
});