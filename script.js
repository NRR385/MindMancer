let questions = [
    "Is your character human?",
    "Is your character tall (>5'10'')?",
    "Is your character fair?",
    "Is your character a beginner gym freak?",
    "Is your character funny?",
    "Is your character a pro gamer?",
    "Is your character handsome?",
    "Is your character popular?"
];

let currentQuestion = 0;

function answer(response) {
    showOverlay();
    
    setTimeout(() => {
        currentQuestion++;
        if (currentQuestion < questions.length) {
            document.getElementById("question").innerText = questions[currentQuestion];
        } else {
            document.getElementById("game").style.display = "none";
            document.getElementById("result").classList.remove("hidden");
            document.getElementById("result-text").innerText = "I couldn't determine your character. Please tell me which character you were thinking of:";
        }
        hideOverlay();
    }, 500);
}

function submitCharacter() {
    const newCharacter = document.getElementById("new-character").value;
    alert(`Thank you! I've noted that you were thinking of ${newCharacter}.`);
    document.getElementById("new-character").value = ''; // Clear input field
}

function showOverlay() {
    document.getElementById("overlay").classList.add("visible");
}

function hideOverlay() {
    document.getElementById("overlay").classList.remove("visible");
}