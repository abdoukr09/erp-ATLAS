import { useEffect } from 'react';

/**
 * En dessous de 768px le CSS retourne chaque <tr> en fiche empilée. Une cellule
 * seule ne veut alors plus rien dire — « 1.3 » sans « Stock actuel » devant.
 *
 * Ce hook recopie le texte du <th> de la colonne dans un attribut data-label sur
 * chaque <td>, que le CSS affiche à gauche de la valeur. Le faire ici, sur le
 * DOM, évite d'aller écrire à la main des centaines de data-label dans les 28
 * tableaux de l'ERP — et les nouveaux tableaux en héritent sans rien changer.
 *
 * Les cellules qui portent un colSpan (lignes « aucun résultat », totaux de
 * pied de tableau) sont laissées telles quelles : elles occupent toute la
 * largeur et n'appartiennent à aucune colonne.
 */
export default function useTableCards() {
  useEffect(() => {
    const stamp = () => {
      document.querySelectorAll('table').forEach(table => {
        const headers = [...table.querySelectorAll('thead th')].map(th =>
          (th.textContent || '').trim()
        );
        if (!headers.length) return;

        table.querySelectorAll('tbody tr').forEach(row => {
          [...row.children].forEach((cell, index) => {
            if (cell.colSpan > 1) {
              cell.removeAttribute('data-label');
              cell.setAttribute('data-fullwidth', '');
              return;
            }
            const label = headers[index];
            // On ne réécrit que si nécessaire : chaque écriture invaliderait le
            // MutationObserver et relancerait une passe.
            if (label && cell.getAttribute('data-label') !== label) {
              cell.setAttribute('data-label', label);
            }
          });
        });
      });
    };

    let frame = null;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        stamp();
      });
    };

    schedule();

    // Les pages chargent leurs données après le premier rendu : on suit les
    // lignes qui apparaissent, disparaissent ou changent de tri.
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}
