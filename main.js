document.addEventListener('DOMContentLoaded', () => {
    console.debug('Launching Stackowey IDE...');
    document.querySelector('main').innerText = 'Loading...';
    
    try {
        //...
        throw new Error('The IDE is not implemented yet!');
    } catch(err) {
        document.querySelector('main').innerHTML = 'An unhandled error occurred and the IDE crashed!<br><br><details id="error"><summary id="error_summary"></summary><pre id="error_stacktrace"></pre></details>';
        document.getElementById('error_summary').innerText = err.toString();
        document.getElementById('error_stacktrace').innerText = err.stack;
        window.stop();
        throw err;
    }
});
