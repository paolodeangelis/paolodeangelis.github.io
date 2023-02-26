---
name: BIG-MAP (Horizon 2020)
tools: [LAMMPS, Python, Jupyter]
keywords: [LIBs, SEI, MD, ReaxFF, DFT]
image: ../img/BIGMAP.png
description: The BIG-MAP project is part of the BATTERY 2030+ initiative and aims to revolutionize the 
            battery innovation by significantly speeding up the discovery and development of new materials. 
            My main contribution focused on using atomistic models to investigate the mechanisms 
            underlying battery degradation.
# external_url: https://www.big-map.eu/
style: european
grant_number: 957189
---

# BIG-MAP

The **Battery Interface Genome – Materials Acceleration Platform** (BIG-MAP) project is a part of the [**BATTERY 2030+**](https://battery2030.eu/) European research initiative aimed at revolutionizing battery innovation through a radical paradigm shift. 
The goal is to dramatically speed up the battery discovery and innovation time, achieving a 5-10 fold increase relative to the current rate of discovery within the next 5-10 years. 
This will be accomplished through the development of a unique R&D infrastructure and accelerated methodology that integrates insights from leading experts, competencies, and data across the entire battery discovery value chain. 
BIG-MAP will use [Artificial Intelligence (AI)](https://en.wikipedia.org/wiki/Artificial_intelligence), [High-Performance Computing (HPC)](https://en.wikipedia.org/wiki/High-performance_computing), large-scale and high-throughput characterization, and autonomous synthesis robotics to reinvent the way we invent batteries. 
The aim is to develop core modules and Key Demonstrators of a Materials Acceleration Platform specifically designed for accelerated discovery of battery materials and interfaces.

I was involved in the European project in Work Package 3 (WP3), which focus was on developing [multiscale models](https://en.wikipedia.org/wiki/Multiscale_modeling) capable of describing materials and phenomena at various resolutions, i.e. from electronic to continuous. 
Specifically, I worked on characterizing the [Solid Electrolyte Interface (SEI)](https://www.nature.com/articles/s41524-018-0064-0), which is a thin passivation layer formed between the anode and electrolyte in batteries. 
To achieve this, I employed [Density Functional Theory (DFT)](https://en.wikipedia.org/wiki/Density_functional_theory) codes to perform quantum simulations, and then used the resulting interaction data to parameterize the [ReaxFF](https://en.wikipedia.org/wiki/ReaxFF) reactive potential, which enabled me to model SEI behavior at the atomistic scale using [Molecular Dynamics (MD)](https://en.wikipedia.org/wiki/Molecular_dynamics) simulations.


<div class="col-lg-8 col-md-10 align-items-center text-center mt-4 center">
    {% 
        include elements/figure_noround.html image="../img/BIGMAP-framework.png" 
        caption="Research framework overview. Going from inside to outside, flowchart overview of our ReaxFF MD project, which aims to build a bottom-up SEI model for lithium-ion batteries as part of the larger multiscale model developed within the BIG-MAP European project. These computational activities are part of the long-term Battery 2030+ initiative." 
    %}
</div>

<p class="text-center">
{% include elements/button.html link="https://www.big-map.eu" text="Learn More" %}
</p>

<div class="text-muted mt-4 col-lg-6 col-md-8">
    <table style="border-collapse: collapse; border: none;">
        <tbody>
            <tr style="border: none;">
                <td style="border: none;min-width:150px">
                    <img style='height:100px, width:auto' src='../img/EUflag.jpg'> 
                </td>
                <td style="border: none;">
                    This project has received funding from the European Union's Horizon 2020 research and innovation programme under grant agreement No <a href="https://cordis.europa.eu/project/id/957189">957189</a>.
                </td>
            </tr>
        </tbody>
    </table>
</div>

