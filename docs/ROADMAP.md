# Milestones and Features

## 1. Milestones
Milestones will represent long-term development goals to help guide the current set of feature tracks. There are 
currently no milestones yet, so work is currently being planned according to feature selection.  

## 2. Feature Tracks
Feature tracks do not adhere to a numbering system, although the lists below do order the currently 
anticipated priority of feature work. Organization and order are subject to change at any time. Feature track work 
mostly involves feature design and implementation, but some project content creation will happen during feature work. 
Dedicated game content work (ex. building MUD rooms) is not yet being tracked.

### 2.1 Current
The short list of features currently being worked on, in parallel.

#### Terminal-Based Webclient UI [A1] (core engine)
- The initial implementation of the webclient.
> In-universe note: The terminal represents the screen of a player's MAGEdeck hacking console. The default mode is 
called "VIRTUAL mode" and represent's the mage's literal view of the virtual (text) world as closely as possible.  

### 2.2 Next
- The list of features that are considered to be currently the highest priorty.

#### Domains [A1] (initial implementation)
- DreamNET's version of MUD zones. Domains are servers and can be connected to directly by a mage using a deck command. 

#### Sites [A1] (initial implementation)
- DreamNET's version of MUD rooms. Sites have a branch<>tree relationship with each other and the domain they're a 
part of. Unsecured sites can also be connected to directly by a mage.

#### NPCs [A1] (basic communication)

#### Game Automated Test Framework [A1]
- Based on Evennia's built-in test framework.

#### Tutorial [A1] (player orientation)
- DreamNET is a fairly high-concept game, so it's decided that a basic tutorial is required even early in the project. 
Even if it's nothing but a conversation with an NPC.

#### Direct Messages [A1] (stub)
- A very minimal implementation of direct messages in the UI. For scripts that allow NPCs to message the player.

#### Webclient Hacking UI [A2] ("MAINT mode")

### 2.3 Planned
Planned features are those that are currently believed to be **very likely** to be implemented.

- Chat [A1]
- Bug Reporting [A1]
- Architechs [A1]
- PROGs [A1]
- Webclient Combat UI [A3] ("BRAIN mode")
- Animation Driver [A2] (builders)