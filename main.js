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
