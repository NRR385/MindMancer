# Define the database with classroom characters
database = [
    {"name": "Govardhan", "human": True, "tall": True, "fair": False, "beginner_gym_freak": True,"pro_gamer": False, "funny": True},
    {"name": "Ronni", "human": True, "tall": True, "fair": True, "beginner_gym_freak": False, "funny": False},
    {"name": "Vats", "human": True, "tall": True, "fair": True,"beginner_gym_freak": True, "pro_gamer": True, "funny": True}, 
    {"name": "dubai settu", "human": True, "tall": True, "fair": False,"beginner_gym_freak": True, "pro_gamer": False, "funny": True},
    {"name": "JD", "human": True, "tall": True, "fair": False,"beginner_gym_freak": False, "funny": False,"pro_gamer": False, "handsome": True, "popular": True},
    {"name": "Gaddam", "human": True, "tall": False, "fair": False, "beginner_gym_freak": False, "pro_gamer": False,"funny": False},   
    {"name": "Nrr", "human": True, "tall": False, "fair": True, "beginner_gym_freak": True, "pro_gamer": False,"funny": False}, # New Student 5
    {"name": "DD", "human": True, "tall": False, "fair": True, "beginner_gym_freak": True,"pro_gamer": False, "funny": True},  # New Student 6
]

def take_chance(answer, property):
    if answer == "y":
        ans = True
    else:
        ans = False

    to_remove = []
    for d in database:
        if property in d and d[property] != ans:
            to_remove.append(d)

    for i in to_remove:
        database.remove(i)

    if len(database) == 1:
        print("Your character is " + database[0]["name"])
        quit()

# Start the game
print("Welcome to MindMancer!")
ans = input("Is your character human (y/n) type y for formality..")
take_chance(ans, "human")

ans = input("Is your character tall (y/n)? ")
take_chance(ans, "tall")

ans = input("Is your character fair(color) (y/n)? ")
take_chance(ans, "fair")

ans = input("Is your character a beginner gym freak (y/n)? ")
take_chance(ans, "beginner_gym_freak")

ans = input("Is your character funny (y/n)? ")
take_chance(ans, "funny")

ans = input("Is your character a pro gamer (y/n)? ")
take_chance(ans, "pro_gamer")

ans = input("Is your character handsome (y/n)? ")
take_chance(ans, "handsome")

ans = input("Is your character popular (y/n)? ")
take_chance(ans, "popular")

# If no character is found
if len(database) > 1:
    print("I couldn't determine your character. Please tell me which character you were thinking of:")
    new_character = input("Enter the character's name: ")
    # Optionally, you can add the new character to the database here
    print(f"Thank you! I've noted that you were thinking of {new_character}.")