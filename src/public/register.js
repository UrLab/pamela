const form = document.querySelector('form');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // send data in json
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });

    const response = await fetch('/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
});