export function showToast(message, duration = 2000) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
            toast.classList.add("hidden");
        }, 300);
    }, duration);
}

export function updateDayStyles() {
    document.querySelectorAll('.day').forEach(dayDiv => {
        const selects = dayDiv.querySelectorAll('select');
        let selectedCount = 0;

        selects.forEach(select => {
            if (select.value !== "") {
                select.style.backgroundColor = "#fff49b";
                selectedCount++;
            } else {
                select.style.backgroundColor = "";
            }
        });

        if (selectedCount === selects.length) {
            dayDiv.style.backgroundColor = "#ffcc80";
        } else {
            dayDiv.style.backgroundColor = "";
        }
    });
}
