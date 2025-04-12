document.addEventListener('DOMContentLoaded', () => {
    console.debug('Launching Stackowey IDE...');

    try {
        const main = document.querySelector('main');
        if (!main)
            throw new Error('Could not find application body!');
        else
            main.innerText = 'Loading...';

        const info = createTitledPopup('About', 'As the normal interpreter for Stackowey is a bit cumbersome to debug with and does not feature the ability to step through the Stackowey code, I\'ve decided that I need to make an online interpreter as well.\nIf you want performance I still suggest you use the normal interpreter.');
        const infoCloseBtn = document.createElement('button');
        infoCloseBtn.innerText = 'Close';
        infoCloseBtn.addEventListener('click', () => {
            info.remove();
        });
        info.querySelector('.popup-body').appendChild(infoCloseBtn);
        const infoOpenBtn = document.createElement('button');
        infoOpenBtn.innerText = 'About';
        infoOpenBtn.style.padding = '1em';
        infoOpenBtn.style.flex = 0;
        infoOpenBtn.addEventListener('click', ()=>{
            document.body.appendChild(info);
        });
        document.querySelector('header:has(h1)')?.appendChild(infoOpenBtn);
        infoOpenBtn.parentElement.style.display = 'flex';
        infoOpenBtn.parentElement.style.flexDirection = 'row';
        infoOpenBtn.previousElementSibling.style.flex = 1;
        delete infoCloseBtn;
        delete infoOpenBtn;
        
        throw new Error('The IDE is not implemented yet!');
        document.getElementById('error_summary').innerText = err.toString();
        document.getElementById('error_stacktrace').innerText = err.stack;
        window.stop();
        throw err;
    }
});

function createTitledPopup(title, text) {
    const overlay = document.createElement('div');
    overlay.classList.add('overlay');
    const popup = document.createElement('fieldset');
    popup.classList.add('overlay-text');
    const legend = document.createElement('legend');
    legend.classList.add('popup-title');
    legend.innerText = title;
    const body = document.createElement('div');
    body.classList.add('popup-body');
    body.innerText = text;
    popup.appendChild(legend);
    popup.appendChild(body);
    overlay.appendChild(popup);
    Object.defineProperties(overlay, {
        titleText: {
            get: () => {
                return legend.innerText;
            },
            set: (title) => {
                return legend.innerText = title;
            }
        },
        bodyText: {
            get: () => {
                return body.innerText;
            },
            set: (text) => {
                return body.innerText = text;
            }
        },
        bodyHTML: {
            get: () => {
                return body.innerHTML;
            },
            set: (html) => {
                return body.innerHTML = html;
            }
        }
    });
    return overlay;
}
